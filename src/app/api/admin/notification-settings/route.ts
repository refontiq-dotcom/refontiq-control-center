import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const defaults = {
  browser_notifications: true, sound_enabled: true, critical_alerts: true,
  warning_alerts: true, info_alerts: false, payment_alerts: true,
  sync_alerts: true, traffic_alerts: true, system_alerts: true,
};
const keys = Object.keys(defaults) as (keyof typeof defaults)[];

async function guard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return { error: NextResponse.json({ error: "Accès non autorisé." }, { status: 403 }) };
  }
  return { user, admin };
}

export async function GET() {
  try {
    const result = await guard();
    if ("error" in result) return result.error;
    const { data } = await result.admin.from("notification_preferences").select("*").eq("user_id", result.user.id).maybeSingle();
    return NextResponse.json({ preferences: { ...defaults, ...(data || {}) } });
  } catch (error) {
    console.error("[notification-settings]", error);
    return NextResponse.json({ error: "Impossible de charger les réglages." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const result = await guard();
    if ("error" in result) return result.error;
    const body = await request.json();
    const patch: Record<string, boolean> = {};
    for (const key of keys) {
      if (typeof body[key] === "boolean") patch[key] = body[key];
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Aucun réglage valide." }, { status: 400 });
    const { data, error } = await result.admin.from("notification_preferences")
      .upsert({ user_id: result.user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("*").single();
    if (error) throw error;
    return NextResponse.json({ preferences: { ...defaults, ...data } });
  } catch (error) {
    console.error("[notification-settings]", error);
    return NextResponse.json({ error: "Impossible d'enregistrer les réglages." }, { status: 500 });
  }
}
