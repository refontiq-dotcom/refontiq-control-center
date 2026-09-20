"use client";

import { AdminPeriodFilter, getPresetRange, type PeriodRange } from "@/components/admin-period-filter";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, RefreshCw, X } from "lucide-react";

type PaymentRequest = {
  id: string;
  produit: string;
  produit_ref: string | null;
  plan: string;
  amount: number;
  status: string;
  sender_phone: string | null;
  created_at: string;
  validated_at: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(value);

export default function AdminBillingPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodRange>(() => getPresetRange("30d"));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: period.from, to: period.to });
      const res = await fetch(`/api/billing?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Chargement impossible");
      setRequests(body.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to]);

  useEffect(() => { void load(); }, [load]);

  async function decide(requestId: string, action: "validate" | "reject") {
    setWorking(requestId);
    setError("");
    try {
      const res = await fetch("/api/billing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setWorking(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <main className="px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour à l'ensemble
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Finance & paiements</h1>
            <p className="text-sm text-slate-500">Vue centrale des demandes de paiement, validations et montants en attente.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <AdminPeriodFilter value={period} onChange={setPeriod} onReset={() => setPeriod(getPresetRange("30d"))} />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">En attente</div><div className="mt-1 text-2xl font-bold">{pending.length}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Montant en attente</div><div className="mt-1 text-2xl font-bold">{money(pending.reduce((s, r) => s + r.amount, 0))}</div></div>
          <div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Historique chargé</div><div className="mt-1 text-2xl font-bold">{processed.length}</div></div>
        </section>

        <section className="rounded-xl border bg-white">
          <div className="border-b p-4"><h2 className="font-semibold text-slate-900">Demandes de paiement</h2></div>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Aucune demande de paiement.</div>
          ) : (
            <div className="divide-y">
              {requests.map((r) => (
                <div key={r.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.produit} • référence {r.produit_ref || "—"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {r.plan} • {new Date(r.created_at).toLocaleString("fr-FR")} • {r.sender_phone || "—"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{money(r.amount)}</div>
                  {r.status === "pending" ? (
                    <div className="flex gap-2">
                      <button disabled={working === r.id} onClick={() => void decide(r.id, "validate")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Valider</button>
                      <button disabled={working === r.id} onClick={() => void decide(r.id, "reject")} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Rejeter</button>
                    </div>
                  ) : <span className="text-xs font-medium uppercase text-slate-500">{r.status}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
