import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPushToAll } from "@/lib/web-push";

const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!SHARED_SECRET || authHeader !== `Bearer ${SHARED_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projet, level = "info", title, message } = body ?? {};
    const allowedProjects = new Set(["sejoura", "schooly", "docly", "trouvetou"]);
    const allowedLevels = new Set(["info", "warning", "error"]);

    if (!allowedProjects.has(projet) || !allowedLevels.has(level) || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Alerte invalide" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("telegram_alerts").insert({
      level,
      title: typeof title === "string" && title.trim() ? title.trim() : `Alerte ${projet}`,
      message: message.trim(),
      sent_at: new Date().toISOString(),
      status: "sent",
    }).select("id,level,title,message,sent_at,status,created_at").single();

    if (error) throw error;
    void sendWebPushToAll({ title: data.title, message: data.message, level: level === "error" ? "critical" : level, href: "/admin/supervision", tag: `alert:${data.id}` }).catch((pushError) => console.error("[web-push alert]", pushError));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[telegram-alerts ingest]", error);
    return NextResponse.json({ error: "Impossible d'enregistrer l'alerte" }, { status: 500 });
  }
}
