import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWebPushToAll } from "@/lib/web-push";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const result = await sendWebPushToAll({
    title: "Refontiq — test de notification",
    message: "Les notifications Web Push sont activées sur cet appareil.",
    level: "info",
    href: "/admin/dashboard",
    tag: "refontiq-test",
  });
  return NextResponse.json(result);
}
