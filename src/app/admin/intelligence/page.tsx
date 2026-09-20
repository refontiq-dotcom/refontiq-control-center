"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bot, CheckCircle2, Clock3, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { REFONTIQ_PROJECTS } from "@/lib/projects";
import { formatFCFA } from "@/lib/utils";

type Health = "healthy" | "warning" | "critical" | "unknown";
type Metric = {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: Health;
  derniere_synchro: string | null;
  details?: Record<string, unknown>;
};
type Snapshot = {
  projet: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: Health;
  captured_at: string;
};
type Intelligence = {
  id: string;
  projet: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  source: string;
  created_at: string;
};

function ageLabel(value?: string | null) {
  if (!value) return "Jamais";
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 1440) return `il y a ${Math.floor(minutes / 60)} h`;
  return `il y a ${Math.floor(minutes / 1440)} j`;
}

function confidence(value?: string | null) {
  if (!value) return { label: "Manquante", className: "bg-slate-100 text-slate-600" };
  const minutes = Math.max(0, Date.now() - new Date(value).getTime()) / 60000;
  if (minutes <= 30) return { label: "Fraîche", className: "bg-emerald-50 text-emerald-700" };
  return { label: "Ancienne", className: "bg-amber-50 text-amber-700" };
}

export default function IntelligencePage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [items, setItems] = useState<Intelligence[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!response.ok) throw new Error("Lecture impossible");
      const data = await response.json();
      setMetrics(data.metrics ?? []);
      setSnapshots(data.snapshots ?? []);
      setItems(data.intelligence ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const trends = useMemo(() => REFONTIQ_PROJECTS.map((project) => {
    const metric = metrics.find((m) => m.projet === project.id);
    const previous = snapshots
      .filter((s) => s.projet === project.id)
      .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())[0];
    return {
      project,
      metric,
      previous,
      accountsDelta: metric && previous ? metric.comptes_actifs - previous.comptes_actifs : null,
      mrrDelta: metric && previous ? metric.mrr - previous.mrr : null,
    };
  }), [metrics, snapshots]);

  const critical = items.filter((item) => item.severity === "critical");
  const warnings = items.filter((item) => item.severity === "warning");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400"><Bot className="h-4 w-4" /> Intelligence Refontiq</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Ce qui mérite votre attention</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Analyse déterministe basée uniquement sur les données reçues. Aucune estimation n'est présentée comme un fait.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser</Button>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="border-slate-200 p-4"><div className="text-xs text-slate-500">Signaux critiques</div><div className="mt-2 text-2xl font-bold">{critical.length}</div></Card>
          <Card className="border-slate-200 p-4"><div className="text-xs text-slate-500">Points à surveiller</div><div className="mt-2 text-2xl font-bold">{warnings.length}</div></Card>
          <Card className="border-slate-200 p-4"><div className="text-xs text-slate-500">Historique disponible</div><div className="mt-2 text-2xl font-bold">{snapshots.length}</div></Card>
        </section>

        <Card className="border-slate-200 p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Confiance des données</h2><p className="mt-1 text-xs text-slate-500">La fraîcheur est distincte de la valeur métier.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {trends.map(({ project, metric }) => {
              const state = confidence(metric?.derniere_synchro);
              return (
                <Link key={project.id} href={`/admin/projects/${project.id}`} className="rounded-xl border p-4 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{project.name}</span><Badge className={state.className}>{state.label}</Badge></div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {ageLabel(metric?.derniere_synchro)}</div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="border-slate-200 p-5">
          <div><h2 className="font-semibold">Détection de variations</h2><p className="mt-1 text-xs text-slate-500">Comparaison avec le dernier instantané disponible.</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {trends.map(({ project, metric, previous, accountsDelta, mrrDelta }) => (
              <div key={project.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between"><span className="font-medium">{project.name}</span>{previous ? <Badge variant="outline">Historique</Badge> : <Badge variant="outline">Nouveau</Badge>}</div>
                {metric && previous ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Comptes</div>
                      <div className="mt-1 flex items-center gap-1 text-sm font-semibold">{accountsDelta !== null && accountsDelta >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-amber-600" />}{accountsDelta !== null && accountsDelta > 0 ? "+" : ""}{accountsDelta}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">MRR</div>
                      <div className="mt-1 text-sm font-semibold">{mrrDelta === null ? "—" : `${mrrDelta >= 0 ? "+" : ""}${formatFCFA(mrrDelta)}`}</div>
                    </div>
                  </div>
                ) : <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-slate-500">Pas assez d'historique pour calculer une variation fiable.</div>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-slate-200 p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">File d'attention</h2><p className="mt-1 text-xs text-slate-500">Chaque signal indique sa source pour rester vérifiable.</p></div></div>
          <div className="mt-4 space-y-2">
            {items.length ? items.map((item) => (
              <Link key={item.id} href={`/admin/projects/${item.projet}`} className={`block rounded-xl border p-4 transition hover:bg-slate-50 ${item.severity === "critical" ? "border-red-200 bg-red-50/40" : item.severity === "warning" ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2 text-sm font-semibold">{item.severity === "critical" ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}{item.title}</div><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">Source : {item.source}</p></div>
                  <span className="shrink-0 text-xs font-medium text-slate-500">{item.projet}</span>
                </div>
              </Link>
            )) : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" /><div className="mt-2">Aucun signal prioritaire détecté.</div></div>}
          </div>
        </Card>
      </div>
    </main>
  );
}
