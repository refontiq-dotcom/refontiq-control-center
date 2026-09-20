"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Users, RefreshCw, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPeriodFilter, getPresetRange, type PeriodRange } from "@/components/admin-period-filter";

type Row = { day: string; visits: number; uniqueVisitors: number };

type TrafficResponse = {
  configured: boolean;
  today?: { visits: number; uniqueVisitors: number };
  history7?: Row[];
  history30?: Row[];
};

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(value + "T00:00:00Z")
  );
}

function TrafficBars({ rows, compact = false }: { rows: Row[]; compact?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row.visits));

  return (
    <div className={compact ? "grid grid-cols-7 gap-2 items-end h-40" : "space-y-3"}>
      {rows.map((row) => {
        const height = Math.max(6, Math.round((row.visits / max) * 100));
        return compact ? (
          <div key={row.day} className="h-full flex flex-col justify-end items-center gap-1">
            <div className="text-[10px] text-slate-500">{formatNumber(row.visits)}</div>
            <div
              className="w-full max-w-8 rounded-t-md bg-slate-900"
              style={{ height: height + "%" }}
              title={`${row.day}: ${row.visits} visites`}
            />
            <div className="text-[10px] text-slate-400">{shortDate(row.day)}</div>
          </div>
        ) : (
          <div key={row.day} className="grid grid-cols-[70px_1fr_80px] items-center gap-3">
            <span className="text-xs text-slate-500">{shortDate(row.day)}</span>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-slate-900" style={{ width: height + "%" }} />
            </div>
            <span className="text-xs font-medium text-slate-700 text-right">
              {formatNumber(row.visits)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrouvetouTrafficPage() {
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodRange>(() => getPresetRange("30d"));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/trouvetou-traffic?from=${period.from}&to=${period.to}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/admin";
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Lecture impossible");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [period.from, period.to]);

  const history7 = data?.history7 ?? [];
  const history30 = data?.history30 ?? [];
  const total30 = useMemo(() => history30.reduce((sum, row) => sum + row.visits, 0), [history30]);

  return (
    <div>
      <header className="border-b border-sky-200/60 bg-transparent">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#7C2D12]" />
                <h1 className="font-semibold text-slate-900 dark:text-white">Trafic publicité</h1>
              </div>
              <p className="text-xs text-slate-500">Suivi du trafic publicitaire</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

        <AdminPeriodFilter value={period} onChange={setPeriod} onReset={() => setPeriod(getPresetRange("30d"))} />

        {!data?.configured && !loading && (
          <Card className="p-5">
            <p className="font-medium text-slate-800">Collecte du trafic en attente</p>
            <p className="text-sm text-slate-500 mt-1">
              La section est prête. Trouvetou doit maintenant alimenter la table de trafic quotidienne.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Eye className="w-4 h-4" /> Visites en fin de période
            </div>
            <div className="text-3xl font-bold mt-2 text-slate-900">
              {formatNumber(data?.today?.visits ?? 0)}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Users className="w-4 h-4" /> Visiteurs uniques en fin de période
            </div>
            <div className="text-3xl font-bold mt-2 text-slate-900">
              {formatNumber(data?.today?.uniqueVisitors ?? 0)}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <BarChart3 className="w-4 h-4" /> Visites sur la période
            </div>
            <div className="text-3xl font-bold mt-2 text-slate-900">
              {formatNumber(total30)}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900">Historique — 7 jours</h2>
              <p className="text-xs text-slate-500 mt-1">Volume quotidien des visites</p>
            </div>
          </div>
          {history7.length ? (
            <TrafficBars rows={history7} compact />
          ) : (
            <p className="text-sm text-slate-500">Aucune donnée disponible.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Historique — période sélectionnée</h2>
            <p className="text-xs text-slate-500 mt-1">Vue complète du trafic quotidien</p>
          </div>
          {history30.length ? (
            <TrafficBars rows={history30} />
          ) : (
            <p className="text-sm text-slate-500">Aucune donnée disponible.</p>
          )}
        </Card>
      </main>
    </div>
  );
}
