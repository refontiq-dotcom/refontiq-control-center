import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

// ============================================================================
// GET /api/metrics — Refontiq Control Center (projet NEUTRE).
// Lecture des métriques consolidées (portfolio_metrics) pour le dashboard.
// Réservé au Super Admin authentifié (session Supabase + role super_admin).
// ============================================================================

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
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
