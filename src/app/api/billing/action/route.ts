import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id,role,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
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

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      action === "validate" ? "validate_payment_request" : "reject_payment_request",
      { p_request_id: requestId }
    );
    if (error) throw error;

    const request = Array.isArray(data) ? data[0] : data;
    if (!request) throw new Error("Demande introuvable");

    const callbackConfig: Record<string, string | undefined> = {
      schooly: process.env.SCHOOLY_URL?.replace(/\/$/, ""),
      sejoura: process.env.SEJOURA_URL?.replace(/\/$/, ""),
    };
    const productUrl = callbackConfig[request.produit];

    if (productUrl && SHARED_SECRET) {
      const callbackPath =
        request.produit === "schooly"
          ? "/api/billing/control-center-decision"
          : "/api/billing/control-center-decision";

      const callback = await fetch(`${productUrl}${callbackPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SHARED_SECRET}`,
        },
        body: JSON.stringify({
          requestId: request.produit_ref,
          action,
          controlCenterRequestId: request.id,
          validatorId: superAdmin.id,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!callback.ok) {
        console.error(`[billing action] ${request.produit} callback failed:`, callback.status, await callback.text());
        return NextResponse.json({
          success: true,
          action,
          data: request,
          warning: `Décision enregistrée au Control Center, mais ${request.produit} n'a pas confirmé la synchronisation.`,
        });
      }
    }

    await admin.from("telegram_alerts").insert({
      level: action === "validate" ? "success" : "warning",
      type: "billing",
      title: `Paiement ${request.produit} ${action === "validate" ? "validé" : "rejeté"}`,
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
