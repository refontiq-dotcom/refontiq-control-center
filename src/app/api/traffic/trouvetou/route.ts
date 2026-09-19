import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !SHARED_SECRET || authHeader !== `Bearer ${SHARED_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date = typeof body?.date === "string" ? body.date : "";
    const visits = Number(body?.visits);
    const uniqueVisitors = Number(body?.unique_visitors);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }

    if (
      !Number.isInteger(visits) ||
      visits < 0 ||
      !Number.isInteger(uniqueVisitors) ||
      uniqueVisitors < 0
    ) {
      return NextResponse.json({ error: "Statistiques invalides" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("trouvetou_traffic_daily")
      .upsert(
        {
          day: date,
          visits,
          unique_visitors: uniqueVisitors,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "day" }
      )
      .select()
      .single();

    if (error) {
      console.error("Trouvetou traffic ingest error:", error);
      return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Trouvetou traffic ingest error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
