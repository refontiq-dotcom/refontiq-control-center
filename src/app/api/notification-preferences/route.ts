import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const defaults = {
  browser_notifications: true, sound_enabled: true, critical_alerts: true,
  warning_alerts: true, info_alerts: false, payment_alerts: true,
  sync_alerts: true, traffic_alerts: true, system_alerts: true,
};

async function getSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!profile || profile.role !== "super_admin" || profile.is_active === false) return null;
  return { user, admin };
}

export async function GET() {
  const auth = await getSuperAdmin();
  if (!auth) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  const { data, error } = await auth.admin.from("notification_preferences").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Lecture des réglages impossible." }, { status: 500 });
  return NextResponse.json({ preferences: { ...defaults, ...(data || {}) } });
}

export async function PUT(req: Request) {
  const auth = await getSuperAdmin();
  if (!auth) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corps invalide." }, { status: 400 }); }
  const values = Object.fromEntries(Object.keys(defaults).map((key) => [key, body?.[key] === true]));
  const { data, error } = await auth.admin.from("notification_preferences")
    .upsert({ user_id: auth.user.id, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*").single();
  if (error) return NextResponse.json({ error: "Impossible d'enregistrer les réglages." }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
