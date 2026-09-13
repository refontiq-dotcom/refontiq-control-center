import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("telegram_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ alerts: data ?? [] });
  } catch (err: any) {
    console.error("[telegram-alerts GET]", err);
    return NextResponse.json({ error: "Impossible de charger les alertes" }, { status: 500 });
  }
}
