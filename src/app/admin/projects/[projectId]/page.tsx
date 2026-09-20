"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/utils";
import { REFONTIQ_PROJECTS, type RefontiqProject } from "@/lib/projects";
import { ADMIN_LOGIN_ROUTE } from "@/lib/routes";

type Health = "healthy" | "warning" | "critical" | "unknown";

interface PortfolioMetric {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: Health;
  derniere_synchro: string;
  details?: Record<string, number | string | boolean>;
}

interface PaymentRequest {
  id: string;
  produit: string;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

function healthMeta(health: Health) {
  return {
    healthy: { label: "Sain", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    warning: { label: "Attention", className: "bg-amber-50 text-amber-700 border-amber-200" },
    critical: { label: "Critique", className: "bg-red-50 text-red-700 border-red-200" },
    unknown: { label: "Données indisponibles", className: "bg-slate-50 text-slate-600 border-slate-200" },
  }[health];
}

function relativeDate(value?: string | null) {
  if (!value) return "Jamais synchronisé";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Date invalide";
  const minutes = Math.floor(Math.max(0, Date.now() - time) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export default function ProjectCockpitPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const project = REFONTIQ_PROJECTS.find((item) => item.id === params.projectId) as RefontiqProject | undefined;
  const [metric, setMetric] = useState<PortfolioMetric | null>(null);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!project) return;
    try {
      setError(null);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }

      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lecture impossible");

      setMetric((body.metrics ?? []).find((item: PortfolioMetric) => item.projet === project.id) ?? null);
      setPayments((body.pendingPayments ?? []).filter((item: PaymentRequest) => item.produit === project.id));
      setAlerts((body.alerts ?? []).filter((item: Alert) => item.type?.toLowerCase().includes(project.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le projet.");
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const health = healthMeta(metric?.statut_sante ?? "unknown");
  const stale = !metric?.derniere_synchro || (Date.now() - new Date(metric.derniere_synchro).getTime()) > 30 * 60 * 1000;
  const pendingAmount = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [payments]);

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <Card className="mx-auto max-w-xl p-8 text-center">
          <h1 className="text-lg font-semibold">Projet introuvable</h1>
          <Button className="mt-4" onClick={() => router.push("/admin/dashboard")}>Retour à l'ensemble</Button>
        </Card>
      </main>
    );
  }

  if (loading) {
    return <div className="flex min-h-[80vh] items-center justify-center bg-slate-50"><RefreshCw className="h-7 w-7 animate-spin text-slate-700" /></div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" /> Vue d'ensemble
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: project.accent }}>
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                  <Badge variant="outline" className={health.className}>{health.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{project.tagline}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void load()} className="gap-2"><RefreshCw className="h-4 w-4" /> Actualiser</Button>
            <a href={project.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50">Ouvrir le projet <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </div>

        {error && <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</Card>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Wallet className="h-4 w-4" /> Revenus / MRR</div>
            <div className="mt-2 text-2xl font-bold">{metric ? formatFCFA(metric.mrr) : "—"}</div>
            <div className="mt-1 text-[11px] text-slate-500">{metric ? "montant transmis par le projet" : "donnée non synchronisée"}</div>
          </Card>
          <Card className="border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Users className="h-4 w-4" /> Clients / comptes actifs</div>
            <div className="mt-2 text-2xl font-bold">{metric ? metric.comptes_actifs.toLocaleString("fr-FR") : "—"}</div>
            <div className="mt-1 text-[11px] text-slate-500">source : métriques reçues</div>
          </Card>
          <Card className="border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500"><CreditCard className="h-4 w-4" /> Paiements en attente</div>
            <div className="mt-2 text-2xl font-bold">{payments.length}</div>
            <div className="mt-1 text-[11px] text-slate-500">{formatFCFA(pendingAmount)} à traiter</div>
          </Card>
          <Card className={`border-slate-200 p-4 ${stale ? "border-amber-200 bg-amber-50/40" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> Synchronisation</div>
            <div className="mt-2 text-lg font-bold">{metric ? relativeDate(metric.derniere_synchro) : "Aucune"}</div>
            <div className="mt-1 text-[11px] text-slate-500">{stale ? "Donnée à vérifier" : "donnée récente"}</div>
          </Card>
        </section>

        {metric?.details && Object.keys(metric.details).length > 0 && (
          <Card className="border-slate-200 p-5">
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Indicateurs propres à {project.name}</h2><p className="mt-1 text-xs text-slate-500">Données remontées directement par le projet lors de sa dernière synchronisation.</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(metric.details).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{key.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{typeof value === "number" ? value.toLocaleString("fr-FR") : String(value)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200 p-5">
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Finance & paiements</h2><p className="mt-1 text-xs text-slate-500">Tout ce qui concerne uniquement {project.name}.</p></div></div>
            <div className="mt-4 space-y-2">
              {payments.length ? payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div><div className="text-sm font-medium">{payment.plan}</div><div className="text-[11px] text-slate-500">{new Date(payment.created_at).toLocaleString("fr-FR")}</div></div>
                  <div className="text-right"><div className="text-sm font-semibold">{formatFCFA(payment.amount)}</div><div className="text-[11px] text-amber-700">{payment.status}</div></div>
                </div>
              )) : <div className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-500">Aucun paiement en attente pour ce projet.</div>}
            </div>
            <Link href="/admin/billing" className="mt-4 inline-flex items-center text-xs font-semibold text-slate-700 underline">Ouvrir le centre des paiements</Link>
          </Card>

          <Card className="border-slate-200 p-5">
            <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Alertes & incidents</h2><p className="mt-1 text-xs text-slate-500">Signaux rattachés à {project.name}.</p></div></div>
            <div className="mt-4 space-y-2">
              {alerts.length ? alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border p-3"><div className="text-[10px] uppercase tracking-wide text-slate-400">{alert.type}</div><div className="mt-1 text-sm">{alert.message}</div><div className="mt-1 text-[10px] text-slate-400">{new Date(alert.created_at).toLocaleString("fr-FR")}</div></div>
              )) : <div className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-500">Aucune alerte actuellement.</div>}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200 p-5">
            <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Critiques & améliorations</h2><p className="mt-1 text-xs text-slate-500">Espace réservé aux retours et recommandations spécifiques au projet.</p></div></div>
            <div className="mt-4 rounded-xl border border-dashed p-6 text-center">
              <Lightbulb className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">Aucun retour connecté</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Aucun commentaire ou audit spécifique à {project.name} n'est actuellement enregistré. Aucune recommandation fictive n'est affichée.</p>
            </div>
          </Card>

          <Card className="border-slate-200 p-5">
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-slate-500" /><div><h2 className="font-semibold">Points à surveiller</h2><p className="mt-1 text-xs text-slate-500">Lecture intelligente basée uniquement sur les données disponibles.</p></div></div>
            <div className="mt-4 space-y-2">
              {stale && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La dernière synchronisation est absente ou trop ancienne. Vérifier la remontée des métriques.</div>}
              {!metric && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Aucune métrique reçue pour ce projet. Le Control Center ne calcule pas de valeur à partir d'une estimation.</div>}
              {metric?.statut_sante === "critical" && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Le projet a signalé un état critique.</div>}
              {metric?.statut_sante === "warning" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Le projet a signalé un état nécessitant une attention.</div>}
              {!stale && metric && metric.statut_sante === "healthy" && !payments.length && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />Aucun point prioritaire détecté dans les données reçues.</div>}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
