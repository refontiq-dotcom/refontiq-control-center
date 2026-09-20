import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const defaults = {
  browser_notifications: true, sound_enabled: true, critical_alerts: true,
  warning_alerts: true, info_alerts: false, payment_alerts: true,
  sync_alerts: true, traffic_alerts: true, system_alerts: true,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ preferences: { ...defaults, ...(data || {}) } });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  const values = Object.fromEntries(Object.keys(defaults).map((key) => [key, Boolean(body?.[key])]));
  const admin = createAdminClient();
  const { data, error } = await admin.from("notification_preferences")
    .upsert({ user_id: user.id, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*").single();
  if (error) return NextResponse.json({ error: "Impossible d'enregistrer les réglages" }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
