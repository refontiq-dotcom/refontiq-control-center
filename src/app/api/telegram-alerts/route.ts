import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

// Lecture des dernières alertes. Réservé au Super Admin : cette route lit avec
// le rôle de service, donc sans garde elle exposait les alertes à tout visiteur.
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("telegram_alerts")
      .select("id, level, type, title, message, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ alerts: data ?? [] });
  } catch (err) {
    console.error("[telegram-alerts GET]", err);
    return NextResponse.json({ error: "Impossible de charger les alertes" }, { status: 500 });
  }
}
