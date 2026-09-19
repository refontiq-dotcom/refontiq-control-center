import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(profile?.role === "super_admin" && profile.is_active !== false);
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);

  const { data, error } = await admin
    .from("trouvetou_traffic_daily")
    .select("day,visits,unique_visitors")
    .gte("day", start.toISOString().slice(0, 10))
    .lte("day", today.toISOString().slice(0, 10))
    .order("day", { ascending: true });

  if (error) {
    console.error("[trouvetou traffic]", error);
    return NextResponse.json(
      { error: "Les données de trafic ne sont pas encore disponibles.", configured: false, history: [] },
      { status: 200 }
    );
  }

  const history = data ?? [];
  const todayKey = today.toISOString().slice(0, 10);
  const todayRow = history.find((row) => row.day === todayKey);

  return NextResponse.json({
    configured: true,
    today: {
      visits: Number(todayRow?.visits ?? 0),
      uniqueVisitors: Number(todayRow?.unique_visitors ?? 0),
    },
    history7: history.slice(-7).map((row) => ({
      day: row.day,
      visits: Number(row.visits),
      uniqueVisitors: Number(row.unique_visitors),
    })),
    history30: history.map((row) => ({
      day: row.day,
      visits: Number(row.visits),
      uniqueVisitors: Number(row.unique_visitors),
    })),
  });
}
