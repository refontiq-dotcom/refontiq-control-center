import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const subject = process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:admin@refontiq.com";

function configured() {
  return Boolean(publicKey && privateKey);
}

if (configured()) webpush.setVapidDetails(subject, publicKey!, privateKey!);

export async function sendWebPushToAll(payload: {
  title: string;
  message: string;
  level?: string;
  href?: string;
  tag?: string;
}) {
  if (!configured()) return { sent: 0, skipped: true };
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth");
  if (error) throw error;

  let sent = 0;
  for (const subscription of subscriptions ?? []) {
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
  return { sent, skipped: false };
}
