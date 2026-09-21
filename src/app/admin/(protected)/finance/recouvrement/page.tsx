"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, ShieldAlert, Clock3, CheckCircle2, Ban } from "lucide-react"

type Row = {
  school_id: string
  school_name: string
  city: string | null
  status: "active" | "grace" | "restricted" | "suspended"
  billable_students: number
  billed_amount: number
  covered_amount: number
  remaining_amount: number
  oldest_unpaid_at: string | null
  days_overdue: number
  last_evaluated_at: string
}

const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(value)

const statusMeta = {
  active: { label: "À jour", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  grace: { label: "Grâce", className: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock3 },
  restricted: { label: "Restreint", className: "bg-amber-50 text-amber-700 border-amber-200", icon: ShieldAlert },
  suspended: { label: "Suspendu", className: "bg-red-50 text-red-700 border-red-200", icon: Ban },
} as const

export default function RecouvrementPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/billing/recouvrement", { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Chargement impossible")
      setRows(body.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => ({
    active: rows.filter(r => r.status === "active").length,
    grace: rows.filter(r => r.status === "grace").length,
    restricted: rows.filter(r => r.status === "restricted").length,
    suspended: rows.filter(r => r.status === "suspended").length,
    totalDue: rows.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0),
  }), [rows])

  const ordered = [...rows].sort((a, b) => Number(b.remaining_amount) - Number(a.remaining_amount))

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/finance" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" /> Finance & paiements
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Recouvrement Schooly</h1>
            <p className="text-sm text-slate-500">Suivi des impayés et des états d’accès, calculés à partir des inscriptions confirmées.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">À jour</div><div className="mt-1 text-2xl font-bold">{stats.active}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Grâce</div><div className="mt-1 text-2xl font-bold">{stats.grace}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Restreints</div><div className="mt-1 text-2xl font-bold">{stats.restricted}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Suspendus</div><div className="mt-1 text-2xl font-bold">{stats.suspended}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">À recouvrer</div><div className="mt-1 text-xl font-bold">{money(stats.totalDue)}</div></div>
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
          Le délai de paiement suit chaque inscription confirmée : une inscription tardive en janvier ou février démarre son propre délai. L’année scolaire peut donc produire de nouvelles créances jusqu’à la fin réelle des inscriptions.
        </div>

        <section className="rounded-xl border bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Chargement du recouvrement…</div>
          ) : ordered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Aucune donnée de recouvrement.</div>
          ) : (
            <div className="divide-y">
              {ordered.map((row) => {
                const meta = statusMeta[row.status]
                const Icon = meta.icon
                return (
                  <div key={row.school_id} className="grid gap-3 p-4 lg:grid-cols-[1.6fr_0.7fr_0.9fr_0.9fr_1.1fr_0.8fr] lg:items-center">
                    <div>
                      <div className="font-medium text-slate-900">{row.school_name}</div>
                      <div className="text-xs text-slate-500">{row.city || "—"} • {row.billable_students} élève{row.billable_students > 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-sm">{money(row.billed_amount)}</div>
                    <div className="text-sm text-slate-600">{money(row.covered_amount)} couvert</div>
                    <div className="text-sm font-semibold text-slate-900">{money(row.remaining_amount)}</div>
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${meta.className}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      {row.status !== "active" && <div className="mt-1 text-[11px] text-slate-500">{row.days_overdue} jour{row.days_overdue > 1 ? "s" : ""} de retard</div>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.oldest_unpaid_at ? new Date(row.oldest_unpaid_at).toLocaleDateString("fr-FR") : "—"}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
