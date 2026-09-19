import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: metrics, error: metricsError }, { data: payments, error: paymentsError }, { data: alerts, error: alertsError }] =
    await Promise.all([
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
    ]);

  if (metricsError || paymentsError || alertsError) {
    console.error("[admin overview]", { metricsError, paymentsError, alertsError });
    return NextResponse.json({ error: "Lecture du Control Center impossible." }, { status: 500 });
  }

  return NextResponse.json({
    metrics: metrics ?? [],
    pendingPayments: payments ?? [],
    alerts: alerts ?? [],
  });
}
