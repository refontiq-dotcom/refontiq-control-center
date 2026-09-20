import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPushToAll } from "@/lib/web-push";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!profile || profile.role !== "super_admin" || profile.is_active === false) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  const result = await sendWebPushToAll({
    title: "Refontiq — test de notification",
    message: "Les notifications Web Push sont activées sur cet appareil.",
    level: "info",
    category: "system_alerts",
    href: "/admin/dashboard",
    tag: "refontiq-test",
  });
  return NextResponse.json(result);
}
