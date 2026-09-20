import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildDeterministicIntelligence } from "@/lib/intelligence";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question vide." }, { status: 400 });
  if (question.length > 1000) return NextResponse.json({ error: "Question trop longue." }, { status: 400 });

  const [{ data: metrics }, { data: snapshots }, { data: payments }] = await Promise.all([
    admin.from("portfolio_metrics").select("projet,nom,mrr,comptes_actifs,statut_sante,derniere_synchro,details").order("nom"),
    admin.from("portfolio_metric_snapshots").select("projet,nom,mrr,comptes_actifs,statut_sante,captured_at").order("captured_at", { ascending: false }).limit(100),
    admin.from("payment_validation_requests").select("id,produit,plan,amount,status,created_at").eq("status", "pending").limit(25),
  ]);

  const intelligence = buildDeterministicIntelligence(
    (metrics ?? []).map((m) => ({ ...m, details: m.details ?? {} })),
    snapshots ?? [],
    (payments ?? []).map((p) => ({ id: p.id, produit: p.produit, amount: Number(p.amount ?? 0), created_at: p.created_at })),
  );

  const context = {
    metrics: metrics ?? [],
    recentSnapshots: snapshots ?? [],
    pendingPayments: (payments ?? []).map((p) => ({ produit: p.produit, plan: p.plan, amount: Number(p.amount ?? 0), created_at: p.created_at })),
    intelligence,
  };

  const system = `Tu es le copilote du Refontiq Control Center, réservé au Super Admin central. Tu analyses uniquement les données fournies. Tu ne dois jamais inventer un chiffre, une critique, une cause ou une recommandation présentée comme un fait. Si une donnée est absente ou ancienne, dis-le explicitement. Distingue toujours faits, signaux détectés et suggestions d'action. N'affiche aucune donnée personnelle. Réponds en français, de façon concise et opérationnelle. L'utilisateur garde toujours la décision finale.`;

  const token = process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({
      answer: "Le moteur IA n'est pas encore authentifié dans cet environnement. Le moteur d'intelligence déterministe est actif et peut déjà analyser la fraîcheur, les anomalies et les paiements.",
      mode: "deterministic",
      intelligence,
    });
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Question du Super Admin : ${question}\n\nDonnées actuelles :\n${JSON.stringify(context)}` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const result = await response.json().catch(() => ({}));
    const answer = result?.choices?.[0]?.message?.content;
    if (!response.ok || typeof answer !== "string") {
      return NextResponse.json({
        answer: "Le moteur IA n'a pas pu répondre. Voici les signaux déterministes actuellement disponibles.",
        mode: "deterministic",
        intelligence,
      });
    }

    return NextResponse.json({ answer, mode: "ai", intelligence });
  } catch (error) {
    console.error("[admin assistant]", error);
    return NextResponse.json({
      answer: "Le moteur IA est temporairement indisponible. Les signaux déterministes restent disponibles.",
      mode: "deterministic",
      intelligence,
    });
  }
}
