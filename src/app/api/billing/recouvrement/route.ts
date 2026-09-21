import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

async function requireSuperAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role,is_active").eq("auth_user_id", user.id).maybeSingle()
  return data?.role === "super_admin" && data?.is_active !== false
}

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const base = (process.env.SCHOOLY_URL || "").replace(/\/$/, "")
  const secret = process.env.METRICS_PUSH_SECRET
  if (!base || !secret) return NextResponse.json({ error: "Intégration Schooly non configurée" }, { status: 503 })

  try {
    const response = await fetch(`${base}/api/billing/control-center-overview`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.json()
    if (!response.ok) return NextResponse.json({ error: body.error || "Schooly indisponible" }, { status: 502 })
    return NextResponse.json(body)
  } catch (error) {
    console.error("[billing recouvrement]", error)
    return NextResponse.json({ error: "Impossible de joindre Schooly" }, { status: 502 })
  }
}
