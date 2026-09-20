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

export async function GET(req: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !to) || (!from && to) || (from && to && from > to)) return NextResponse.json({ error: "Période invalide" }, { status: 400 });

  const admin = createAdminClient();
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const endKey = to || todayKey;
  const startDate = new Date(`${from || new Date(today.getTime() - 29 * 86400000).toISOString().slice(0,10)}T00:00:00Z`);

  const { data, error } = await admin
    .from("trouvetou_traffic_daily")
    .select("day,visits,unique_visitors")
    .gte("day", from || startDate.toISOString().slice(0, 10))
    .lte("day", endKey)
    .order("day", { ascending: true });

  if (error) {
    console.error("[trouvetou traffic]", error);
    return NextResponse.json(
      { error: "Les données de trafic ne sont pas encore disponibles.", configured: false, history: [] },
      { status: 200 }
    );
  }

  const history = data ?? [];
  const selectedEndRow = history.find((row) => row.day === endKey) ?? history[history.length - 1];

  return NextResponse.json({
    configured: true,
    today: {
      visits: Number(selectedEndRow?.visits ?? 0),
      uniqueVisitors: Number(selectedEndRow?.unique_visitors ?? 0),
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
