import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "Abonnement Web Push invalide" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null, updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Impossible d'enregistrer l'appareil" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
