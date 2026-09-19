import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data?.role === "super_admin" && data?.is_active !== false;
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscription_payment_requests")
    .select("id,product_id,tenant_id,amount,status,sender_phone,payment_provider,created_at,validated_at")
    .eq("product_id", "schooly")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[billing GET]", error);
    return NextResponse.json({ error: "Impossible de charger la facturation" }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
