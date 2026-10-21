import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

// Crée une alerte de démonstration. Réservé au Super Admin : sans ce garde,
// n'importe quel visiteur pouvait écrire dans telegram_alerts (rôle de service).
export async function POST() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("telegram_alerts").insert({
      level: "info",
      type: "demo",
      title: "Test alerte démo",
      message: "Ce message est une alerte factice créée depuis le dashboard Réglages.",
      sent_at: new Date().toISOString(),
      status: "sent",
    });

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Alerte démo créée." });
  } catch (err) {
    console.error("[demo-alert POST]", err);
    return NextResponse.json({ error: "Impossible de créer l'alerte démo" }, { status: 500 });
  }
}
