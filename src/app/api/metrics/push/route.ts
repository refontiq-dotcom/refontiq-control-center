import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Clé partagée pour authentifier les produits
const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;

export async function POST(req: Request) {
  // Vérification de la clé partagée
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !SHARED_SECRET || authHeader !== `Bearer ${SHARED_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projet, nom, mrr, comptes_actifs, statut_sante } = body;

    // Validation basique
    if (!projet || !nom) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Upsert dans portfolio_metrics
    const { data, error } = await admin
      .from("portfolio_metrics")
      .upsert(
        {
          projet,
          nom,
          mrr: mrr || 0,
          comptes_actifs: comptes_actifs || 0,
          statut_sante: statut_sante || "unknown",
          derniere_synchro: new Date().toISOString(),
        },
        { onConflict: "projet" }
      )
      .select()
      .single();

    if (error) {
      console.error("Metrics push error:", error);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Metrics push error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
