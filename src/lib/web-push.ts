import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const subject = process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:admin@refontiq.com";

const defaults = {
  browser_notifications: true, sound_enabled: true, critical_alerts: true,
  warning_alerts: true, info_alerts: false, payment_alerts: true,
  sync_alerts: true, traffic_alerts: true, system_alerts: true,
};

function configured() {
  return Boolean(publicKey && privateKey);
}

if (configured()) webpush.setVapidDetails(subject, publicKey!, privateKey!);

function allowed(level: string, category: keyof typeof defaults, prefs: typeof defaults) {
  if (!prefs.browser_notifications) return false;
  if (!prefs[category]) return false;
  if (level === "critical") return prefs.critical_alerts;
  if (level === "warning") return prefs.warning_alerts;
  return prefs.info_alerts;
}

export async function sendWebPushToAll(payload: {
  title: string;
  message: string;
  level?: string;
  category?: keyof typeof defaults;
  href?: string;
  tag?: string;
}) {
  if (!configured()) return { sent: 0, skipped: true };
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth");
  if (error) throw error;

  const userIds = [...new Set((subscriptions ?? []).map((s) => s.user_id))];
  const { data: preferenceRows } = userIds.length
    ? await admin.from("notification_preferences").select("*").in("user_id", userIds)
    : { data: [] as any[] };
  const preferences = new Map((preferenceRows ?? []).map((row) => [row.user_id, { ...defaults, ...row }]));
  const category = payload.category || "system_alerts";
  const level = payload.level || "info";

  let sent = 0;
  let skipped = 0;
  for (const subscription of subscriptions ?? []) {
    const prefs = preferences.get(subscription.user_id) || defaults;
    if (!allowed(level, category, prefs)) { skipped++; continue; }
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      } else {
        console.error("[web-push]", error);
      }
    }
  }
  return { sent, skipped, configured: true };
}
