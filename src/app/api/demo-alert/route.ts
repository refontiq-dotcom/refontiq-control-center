import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("telegram_alerts").insert({
      level: "info",
      title: "Test alerte démo",
      message: "Ce message est une alerte factice créée depuis le dashboard Réglages.",
      sent_at: new Date().toISOString(),
      status: "sent",
    });

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Alerte démo créée." });
  } catch (err: any) {
    console.error("[demo-alert POST]", err);
    return NextResponse.json({ error: "Impossible de créer l'alerte démo" }, { status: 500 });
  }
}
