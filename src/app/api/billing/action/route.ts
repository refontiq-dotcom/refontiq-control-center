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

export async function POST(req: Request) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { requestId, action } = await req.json();
    if (!requestId || !["validate", "reject"].includes(action)) {
      return NextResponse.json({ error: "requestId et action requis" }, { status: 400 });
    }

    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    const admin = createAdminClient();
    const rpc = action === "validate"
      ? "validate_subscription_payment"
      : "reject_subscription_payment";

    const { data, error } = await admin.rpc(rpc, {
      p_request_id: requestId,
      p_validator_id: user?.id ?? null,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, action, data });
  } catch (error) {
    console.error("[billing action]", error);
    return NextResponse.json({ error: "Action de facturation impossible" }, { status: 500 });
  }
}
