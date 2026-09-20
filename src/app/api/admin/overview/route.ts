import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildDeterministicIntelligence } from "@/lib/intelligence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const hasPeriod = Boolean(from && to);
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

  if ((from && !to) || (!from && to)) {
    return NextResponse.json({ error: "La période doit contenir une date de début et une date de fin." }, { status: 400 });
  }
  if (hasPeriod && (from! > to!)) {
    return NextResponse.json({ error: "La date de début doit être antérieure ou égale à la date de fin." }, { status: 400 });
  }

  const endExclusive = hasPeriod ? new Date(new Date(to! + "T00:00:00Z").getTime() + 86400000).toISOString() : null;
  const startIso = hasPeriod ? new Date(from! + "T00:00:00Z").toISOString() : null;

  const [
    { data: currentMetrics, error: metricsError },
    { data: payments, error: paymentsError },
    { data: alerts, error: alertsError },
    { data: snapshots, error: snapshotsError },
  ] = await Promise.all([
    admin.from("portfolio_metrics").select("*").order("nom"),
    admin.from("payment_validation_requests")
      .select("id,produit,produit_ref,plan,amount,status,created_at")
      .gte("created_at", startIso ?? "1970-01-01T00:00:00Z")
      .lt("created_at", endExclusive ?? new Date(Date.now() + 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("telegram_alerts")
      .select("id,type,title,message,level,created_at")
      .gte("created_at", startIso ?? "1970-01-01T00:00:00Z")
      .lt("created_at", endExclusive ?? new Date(Date.now() + 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("portfolio_metric_snapshots")
      .select("projet,nom,mrr,comptes_actifs,statut_sante,captured_at")
      .gte("captured_at", startIso ?? "1970-01-01T00:00:00Z")
      .lt("captured_at", endExclusive ?? new Date(Date.now() + 86400000).toISOString())
      .order("captured_at", { ascending: false })
      .limit(1000),
  ]);

  const metrics = hasPeriod
    ? Object.values((snapshots ?? []).reduce<Record<string, typeof snapshots[number]>>((acc, row) => {
        if (!acc[row.projet]) acc[row.projet] = row;
        return acc;
      }, {}))
    : currentMetrics;

  if (metricsError || paymentsError || alertsError || snapshotsError) {
    console.error("[admin overview]", { metricsError, paymentsError, alertsError, snapshotsError });
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
    metrics: periodMetrics,
    pendingPayments: (payments ?? []).filter((payment) => payment.status === "pending"),
    alerts: alerts ?? [],
    snapshots: snapshots ?? [],
    intelligence: computedIntelligence,
    period: hasPeriod ? { from, to } : null,
  });
}
