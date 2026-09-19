import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SHARED_SECRET = process.env.METRICS_PUSH_SECRET;

async function requireSuperAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle();
  return data?.role === "super_admin" && data?.is_active !== false;
}

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_validation_requests")
    .select("id,produit,produit_ref,plan,amount,status,requested_by,sender_phone,validated_by,validated_at,notes,created_at")
    .eq("produit", "schooly")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[billing GET]", error);
    return NextResponse.json({ error: "Impossible de charger la facturation" }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  if (!SHARED_SECRET || header !== `Bearer ${SHARED_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (body?.produit !== "schooly" || !body?.produit_ref || !body?.plan) {
      return NextResponse.json({ error: "Demande de facturation invalide" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("payment_validation_requests").insert({
      produit: "schooly",
      produit_ref: String(body.produit_ref),
      plan: String(body.plan),
      amount: Number(body.amount) || 0,
      status: "pending",
      requested_by: body.requested_by ? String(body.requested_by) : null,
      sender_phone: body.sender_phone ? String(body.sender_phone) : null,
      notes: body.notes ? String(body.notes) : null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[billing POST]", error);
    return NextResponse.json({ error: "Impossible d'enregistrer la demande" }, { status: 500 });
  }
}
