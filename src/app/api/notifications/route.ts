import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const defaults = {
  browser_notifications: true, sound_enabled: true, critical_alerts: true,
  warning_alerts: true, info_alerts: false, payment_alerts: true,
  sync_alerts: true, traffic_alerts: true, system_alerts: true,
};

function categoryForAlert(type: string | null) {
  const value = (type || "").toLowerCase();
  if (value.includes("payment") || value.includes("billing") || value.includes("paiement")) return "payment_alerts";
  if (value.includes("sync") || value.includes("metric") || value.includes("synchron")) return "sync_alerts";
  if (value.includes("traffic") || value.includes("trafic")) return "traffic_alerts";
  return "system_alerts";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const admin = createAdminClient();
    const { data: profile } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
    if (!profile || profile.role !== "super_admin" || profile.is_active === false) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });

    const { data: preferenceRow } = await admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
    const prefs = { ...defaults, ...(preferenceRow || {}) };
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: alerts, error: alertsError }, { data: payments, error: paymentsError }] = await Promise.all([
      admin.from("telegram_alerts").select("id,type,level,title,message,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      admin.from("payment_validation_requests").select("id,produit,plan,amount,status,created_at").eq("status", "pending").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    ]);
    if (alertsError) throw alertsError;
    if (paymentsError) throw paymentsError;
    const items = [
      ...(alerts ?? []).map((a) => {
        const level = a.level === "error" ? "critical" : a.level;
        return { id: "alert:" + a.id, level, category: categoryForAlert(a.type), title: a.title, message: a.message, created_at: a.created_at, href: "/admin/supervision" };
      }),
      ...(payments ?? []).map((p) => ({ id: "payment:" + p.id, level: "warning", category: "payment_alerts", title: "Paiement " + p.produit, message: p.plan + " — " + Number(p.amount || 0).toLocaleString("fr-FR") + " FCFA attend une validation.", created_at: p.created_at, href: "/admin/finance" })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
    return NextResponse.json({ notifications: items, preferences: prefs });
  } catch (error) {
    console.error("[notifications]", error);
    return NextResponse.json({ error: "Impossible de charger les notifications" }, { status: 500 });
  }
}
