import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;
const SCHOOLY_URL = (process.env.SCHOOLY_URL || "").replace(/\/$/, "");

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("users").select("id,role,is_active").eq("auth_user_id", user.id).maybeSingle();
  return data?.role === "super_admin" && data?.is_active !== false ? { id: data.id } : null;
}

export async function POST(req: Request) {
  const superAdmin = await requireSuperAdmin();
  if (!superAdmin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { requestId, action } = await req.json();
    if (!requestId || !["validate", "reject"].includes(action)) {
      return NextResponse.json({ error: "requestId et action requis" }, { status: 400 });
    }

    const admin = createAdminClient();
    const rpc = action === "validate" ? "validate_payment_request" : "reject_payment_request";
    const { data, error } = await admin.rpc(rpc, { p_request_id: requestId });
    if (error) throw error;

    const request = Array.isArray(data) ? data[0] : data;
    if (!request) throw new Error("Demande introuvable");

    if (SCHOOLY_URL && SHARED_SECRET && request.produit === "schooly") {
      const callback = await fetch(`${SCHOOLY_URL}/api/billing/control-center-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHARED_SECRET}` },
        body: JSON.stringify({
          requestId: request.produit_ref,
          action,
          controlCenterRequestId: request.id,
          validatorId: superAdmin.id,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!callback.ok) {
        console.error("[billing action] Schooly callback failed:", callback.status, await callback.text());
        return NextResponse.json({ success: true, action, data: request, warning: "Décision enregistrée au Control Center, mais Schooly n'a pas confirmé la synchronisation." });
      }
    }

    await admin.from("telegram_alerts").insert({
      level: action === "validate" ? "success" : "warning",
      type: "billing",
      title: `Paiement Schooly ${action === "validate" ? "validé" : "rejeté"}`,
      message: `Demande ${request.id} — référence produit ${request.produit_ref}`,
      sent_at: new Date().toISOString(),
      status: "sent",
    });

    return NextResponse.json({ success: true, action, data: request });
  } catch (error) {
    console.error("[billing action]", error);
    return NextResponse.json({ error: "Action de facturation impossible" }, { status: 500 });
  }
}
