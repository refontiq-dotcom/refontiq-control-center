import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// GET /api/metrics — Refontiq Control Center (projet NEUTRE).
// Lecture des métriques consolidées (portfolio_metrics) pour le dashboard.
// Réservé au Super Admin authentifié (session Supabase + role super_admin).
// ============================================================================

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, is_active")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!profile || profile.role !== "super_admin" || profile.is_active === false) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("portfolio_metrics")
    .select("*")
    .order("projet", { ascending: true });

  if (error) {
    console.error("metrics GET:", error);
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }

  return NextResponse.json({ metrics: data ?? [] });
}
