import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, safeEqual } from "@/lib/security/safe-equal";
import { evaluateMonitoring, planNotifications, MONITORED_PROJECTS, type HistoryRow, type MetricRow } from "@/lib/monitoring";
import { escapeMarkdown, getTelegramAdminUrl, isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import { sendWebPushToAll } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 7;

// Déclenché par une planification (GitHub Actions) : un secret DÉDIÉ, jamais celui des métriques.
async function handle(req: Request) {
  const secret = process.env.MONITORING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, code: "monitoring_not_configured", message: "MONITORING_SECRET n'est pas défini sur le Control Center" }, { status: 503 });
  }
  const token = bearerToken(req.headers.get("authorization"));
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const admin = createAdminClient();

  const metrics = await admin.from("portfolio_metrics").select("projet,nom,statut_sante,derniere_synchro");
  if (metrics.error) {
    console.error("[monitoring] lecture des métriques", metrics.error.code);
    return NextResponse.json({ ok: false, stage: "read_metrics", code: "source_unavailable", message: "Lecture des métriques impossible" }, { status: 500 });
  }
  const since = new Date(now - HISTORY_DAYS * 24 * 3600 * 1000).toISOString();
  const history = await admin.from("telegram_alerts").select("type,created_at,status").like("type", "monitor:%").gte("created_at", since);
  if (history.error) {
    console.error("[monitoring] lecture de l'historique", history.error.code);
    return NextResponse.json({ ok: false, stage: "read_history", code: "source_unavailable", message: "Lecture de l'historique des alertes impossible" }, { status: 500 });
  }

  const findings = evaluateMonitoring((metrics.data ?? []) as MetricRow[], now);
  const { toSend, skippedDuplicates } = planNotifications(findings, (history.data ?? []) as HistoryRow[], now);

  const telegramOn = isTelegramConfigured();
  const adminUrl = getTelegramAdminUrl("https://control.refontiq.com/admin/supervision");
  const delivery: Array<{ type: string; telegram: string; web_push: string; recorded: boolean }> = [];

  for (const n of toSend) {
    let telegram = "not_configured";
    if (telegramOn) {
      try {
        telegram = (await sendTelegramMessage(`*${escapeMarkdown(n.title)}*\n${escapeMarkdown(n.message)}\n${adminUrl}`)) ? "sent" : "failed";
      } catch {
        telegram = "failed";
      }
    }
    let webPush = "failed";
    try {
      const r = await sendWebPushToAll({ title: n.title, message: n.message, level: n.level, href: "/admin/supervision", tag: n.type });
      webPush = "skipped" in r && r.skipped ? "not_configured" : "sent";
    } catch {
      webPush = "failed";
    }

    // « failed » seulement si AUCUN canal configuré n'a livré : l'alerte sera alors retentée au prochain passage.
    const delivered = telegram === "sent" || webPush === "sent";
    const attempted = telegram !== "not_configured" || webPush !== "not_configured";
    const status = delivered ? "sent" : attempted ? "failed" : "recorded";

    const insert = await admin.from("telegram_alerts").insert({ level: n.level, type: n.type, title: n.title, message: n.message, status, sent_at: new Date().toISOString() });
    delivery.push({ type: n.type, telegram, web_push: webPush, recorded: !insert.error });
    if (insert.error) console.error("[monitoring] enregistrement de l'alerte", insert.error.code);
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date(now).toISOString(),
    monitored: MONITORED_PROJECTS,
    findings: findings.map((f) => ({ projet: f.projet, kind: f.kind, severity: f.severity, message: f.message })),
    notified: toSend.length,
    skipped_duplicates: skippedDuplicates,
    channels: { telegram_configured: telegramOn },
    delivery,
  });
}

export const GET = handle;
export const POST = handle;
