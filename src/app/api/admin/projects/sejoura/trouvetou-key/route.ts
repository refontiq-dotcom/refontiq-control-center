import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TROUVETOU_URL = process.env.TROUVETOU_INTERNAL_URL ?? "https://trouvetou.vercel.app";
const CONTROL_CENTER_SECRET = process.env.REFONTIQ_CONTROL_CENTER_SECRET;

export async function POST() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  if (!CONTROL_CENTER_SECRET) {
    return NextResponse.json(
      { error: "La liaison sécurisée avec Trouvetou n'est pas configurée." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `${TROUVETOU_URL.replace(/\/$/, "")}/api/internal/control-center/trouvetou-key`,
      {
        method: "POST",
        headers: {
          "x-refontiq-control-center-secret": CONTROL_CENTER_SECRET,
          "content-type": "application/json",
        },
        cache: "no-store",
      },
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: body?.error || "Trouvetou a refusé la rotation de la clé." },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    return NextResponse.json({
      success: true,
      apiKey: body.apiKey,
      provider: body.provider,
      warning: body.warning,
    });
  } catch (error) {
    console.error("[sejoura/trouvetou-key]", error);
    return NextResponse.json(
      { error: "Impossible de joindre Trouvetou." },
      { status: 502 },
    );
  }
}
