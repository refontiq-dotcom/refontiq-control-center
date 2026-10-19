import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

export async function POST(req: Request) {
  // Sans contrôle de rôle, tout compte authentifié pouvait s'abonner et recevoir
  // les alertes du Control Center.
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "Abonnement Web Push invalide" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: auth.admin.authUserId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null, updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Impossible d'enregistrer l'appareil" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
