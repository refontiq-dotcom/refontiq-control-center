import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildDeterministicIntelligence } from "@/lib/intelligence";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const [
    { data: metrics, error: metricsError },
    { data: payments, error: paymentsError },
    { data: alerts, error: alertsError },
    { data: snapshots, error: snapshotsError },
    { data: storedIntelligence, error: intelligenceError },
  ] = await Promise.all([
    admin.from("portfolio_metrics").select("*").order("nom"),
    admin.from("payment_validation_requests")
      .select("id,produit,produit_ref,plan,amount,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(25),
    admin.from("telegram_alerts")
      .select("id,type,title,message,level,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("portfolio_metric_snapshots")
      .select("projet,nom,mrr,comptes_actifs,statut_sante,captured_at")
      .order("captured_at", { ascending: false })
      .limit(250),
    admin.from("project_intelligence_items")
      .select("id,projet,kind,severity,title,message,source,status,metadata,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (metricsError || paymentsError || alertsError || snapshotsError || intelligenceError) {
    console.error("[admin overview]", { metricsError, paymentsError, alertsError, snapshotsError, intelligenceError });
    return NextResponse.json({ error: "Lecture du Control Center impossible." }, { status: 500 });
  }

  const normalizedMetrics = (metrics ?? []).map((metric) => ({
    ...metric,
    details: metric.details ?? {},
  }));
  const normalizedPayments = (payments ?? []).map((payment) => ({
    id: payment.id,
    produit: payment.produit,
    amount: Number(payment.amount ?? 0),
    created_at: payment.created_at,
  }));

  const computedIntelligence = buildDeterministicIntelligence(
    normalizedMetrics,
    snapshots ?? [],
    normalizedPayments,
  );

  return NextResponse.json({
    metrics: normalizedMetrics,
    pendingPayments: payments ?? [],
    alerts: alerts ?? [],
    snapshots: snapshots ?? [],
    intelligence: [...computedIntelligence, ...(storedIntelligence ?? [])],
  });
}
