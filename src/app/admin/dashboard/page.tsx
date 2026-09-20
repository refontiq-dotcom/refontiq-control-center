"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/utils";
import { REFONTIQ_PROJECTS, type RefontiqProject } from "@/lib/projects";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Database,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  BedDouble,
  LogOut,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { ADMIN_LOGIN_ROUTE } from "@/lib/routes";

const POLL_INTERVAL_MS = 30_000;

type MetricsStatus = "synchronisation" | "chargement" | "erreur";
type Health = "healthy" | "warning" | "critical" | "unknown";

interface PortfolioMetric {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: Health;
  derniere_synchro: string;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

interface PaymentRequest {
  id: string;
  produit: string;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
}

const PROJECT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  GraduationCap,
  Stethoscope,
  LayoutDashboard,
  BedDouble,
};

function ProjectIcon({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = PROJECT_ICON_MAP[iconName] || LayoutDashboard;
  return <Icon className={className} />;
}

function formatRelative(value?: string | null) {
  if (!value) return "Jamais synchronisé";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Date invalide";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function healthMeta(health: Health) {
  return {
    healthy: { label: "Sain", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    warning: { label: "Attention", className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    critical: { label: "Critique", className: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    unknown: { label: "Inconnu", className: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  }[health];
}

function syncAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 60_000) : Number.POSITIVE_INFINITY;
}

function ProjectCard({ project, metric }: { project: RefontiqProject; metric?: PortfolioMetric }) {
  const health = healthMeta(metric?.statut_sante ?? "unknown");
  const stale = syncAgeMinutes(metric?.derniere_synchro) > 30;

  return (
    <Link href={`/admin/projects/${project.id}`} className="block">
      <Card className="group overflow-hidden border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1" style={{ backgroundColor: project.accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${project.accent}14`, color: project.accent }}
            >
              <ProjectIcon iconName={project.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-slate-900">{project.name}</h3>
                <span className={`h-2 w-2 rounded-full ${health.dot}`} />
              </div>
              <p className="truncate text-xs text-slate-500">{project.tagline}</p>
            </div>
          </div>
          <Badge variant="outline" className={health.className}>{health.label}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Comptes</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{metric ? metric.comptes_actifs.toLocaleString("fr-FR") : "—"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">MRR</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{metric ? formatFCFA(metric.mrr) : "—"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Sync</div>
            <div className={`mt-1 text-xs font-medium ${stale ? "text-amber-700" : "text-emerald-700"}`}>
              {metric ? formatRelative(metric.derniere_synchro) : "Aucune"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{project.statusLabel ?? "Projet"}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">Voir le cockpit <ChevronRight className="h-3 w-3" /></span>
        </div>
      </div>
      </Card>
    </Link>
  );
}

export default function SuperAdminHubPage() {
  const [loading, setLoading] = useState(true);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>("synchronisation");
  const [metrics, setMetrics] = useState<PortfolioMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | Health>("all");

  const loadData = useCallback(async (silent = false) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }

      setMetricsStatus("chargement");
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Lecture impossible");

      setMetrics(body.metrics ?? []);
      setAlerts(body.alerts ?? []);
      setPendingPayments(body.pendingPayments ?? []);
      setLastSyncAt(new Date().toISOString());
    } catch {
      setMetricsStatus("erreur");
      if (!silent) toast.error("Impossible de synchroniser le Control Center.");
    } finally {
      setLoading(false);
      setMetricsStatus((current) => current === "erreur" ? "erreur" : "synchronisation");
    }
  }, []);

  useEffect(() => {
    void loadData();
    const id = window.setInterval(() => void loadData(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [loadData]);

  const metricByProject = useMemo(
    () => new Map(metrics.map((metric) => [metric.projet, metric])),
    [metrics]
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return REFONTIQ_PROJECTS.filter((project) => {
      const metric = metricByProject.get(project.id);
      const matchesQuery = !query || [project.name, project.tagline, project.description].some((v) => v.toLowerCase().includes(query));
      const matchesHealth = healthFilter === "all" || (metric?.statut_sante ?? "unknown") === healthFilter;
      return matchesQuery && matchesHealth;
    });
  }, [search, healthFilter, metricByProject]);

  const criticalProjects = metrics.filter((m) => m.statut_sante === "critical");
  const warningProjects = metrics.filter((m) => m.statut_sante === "warning");
  const staleProjects = REFONTIQ_PROJECTS.filter((p) => syncAgeMinutes(metricByProject.get(p.id)?.derniere_synchro) > 30);
  const activeAccounts = metrics.reduce((sum, m) => sum + m.comptes_actifs, 0);
  const mrr = metrics.reduce((sum, m) => sum + m.mrr, 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const insights = useMemo(() => {
    const items: Array<{ tone: "critical" | "warning" | "info" | "success"; title: string; text: string; href?: string }> = [];
    if (criticalProjects.length) items.push({ tone: "critical", title: "Action prioritaire", text: `${criticalProjects.length} projet(s) signalent un état critique.`, href: "/admin/integration-checklist" });
    if (staleProjects.length) items.push({ tone: "warning", title: "Synchronisation à vérifier", text: `${staleProjects.length} projet(s) n'ont pas synchronisé leurs métriques depuis plus de 30 minutes.` });
    if (pendingPayments.length) items.push({ tone: "warning", title: "Validation financière", text: `${pendingPayments.length} paiement(s) attendent une décision pour ${formatFCFA(pendingAmount)}.`, href: "/admin/billing" });
    if (!criticalProjects.length && !warningProjects.length && !staleProjects.length && !pendingPayments.length) {
      items.push({ tone: "success", title: "Centre opérationnel", text: "Aucune anomalie prioritaire détectée dans les données reçues." });
    }
    if (!metrics.length) items.push({ tone: "info", title: "Données en attente", text: "Aucun produit n'a encore transmis de métriques au Control Center." });
    return items;
  }, [criticalProjects.length, staleProjects.length, pendingPayments.length, pendingAmount, warningProjects.length, metrics.length]);

  async function handleRefresh() {
    setMetricsStatus("chargement");
    await loadData(true);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = ADMIN_LOGIN_ROUTE;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="h-7 w-7 animate-spin text-slate-700" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold tracking-tight">Refontiq Control Center</div>
              <div className="hidden text-[11px] text-slate-500 sm:block">Super Admin • pilotage centralisé de l'écosystème</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-slate-500 md:inline">{lastSyncAt ? `Synchronisé ${formatRelative(lastSyncAt)}` : "Synchronisation…"}</span>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} className="gap-1.5"><RefreshCw className={`h-4 w-4 ${metricsStatus === "chargement" ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Actualiser</span></Button>
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()} aria-label="Déconnexion"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 md:px-6">
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><Activity className="h-4 w-4" /> CENTRE DE PILOTAGE</div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Vue intelligente de Refontiq</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Une seule console pour surveiller les produits, détecter les situations à traiter, centraliser les paiements et suivre l'intégration.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link href="/admin/billing" className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><CreditCard className="h-4 w-4 text-slate-300" /><div className="mt-2 text-lg font-semibold">{pendingPayments.length}</div><div className="text-[10px] text-slate-400">Paiements</div></Link>
              <Link href="/admin/integration-checklist" className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><CheckCircle2 className="h-4 w-4 text-slate-300" /><div className="mt-2 text-lg font-semibold">Suivi</div><div className="text-[10px] text-slate-400">Intégration</div></Link>
              <Link href="/admin/trouvetou-traffic" className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><TrendingUp className="h-4 w-4 text-slate-300" /><div className="mt-2 text-lg font-semibold">Trafic</div><div className="text-[10px] text-slate-400">Trouvetou</div></Link>
              <Link href="/admin/integration-checklist" className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"><Zap className="h-4 w-4 text-slate-300" /><div className="mt-2 text-lg font-semibold">État</div><div className="text-[10px] text-slate-400">Intégration</div></Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4" /> Produits suivis</div><div className="mt-2 text-2xl font-bold">{REFONTIQ_PROJECTS.filter(p => p.status === "active").length}</div><div className="mt-1 text-[11px] text-slate-500">projets actifs suivis</div></Card>
          <Card className="border-slate-200 p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Users className="h-4 w-4" /> Comptes actifs</div><div className="mt-2 text-2xl font-bold">{activeAccounts.toLocaleString("fr-FR")}</div><div className="mt-1 text-[11px] text-slate-500">données reçues</div></Card>
          <Card className="border-slate-200 p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Wallet className="h-4 w-4" /> MRR consolidé</div><div className="mt-2 text-2xl font-bold">{formatFCFA(mrr)}</div><div className="mt-1 text-[11px] text-slate-500">données reçues</div></Card>
          <Card className={`border-slate-200 p-4 ${criticalProjects.length ? "border-red-200 bg-red-50/40" : ""}`}><div className="flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="h-4 w-4" /> Santé</div><div className="mt-2 text-2xl font-bold">{criticalProjects.length}</div><div className="mt-1 text-[11px] text-slate-500">{criticalProjects.length ? "critique(s)" : "aucun critique"}</div></Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold">Intelligence opérationnelle</h2><p className="mt-1 text-xs text-slate-500">Priorités calculées à partir des données réellement reçues.</p></div>
              <Bot className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 space-y-2">
              {insights.map((item, index) => {
                const styles = {
                  critical: "border-red-200 bg-red-50 text-red-800",
                  warning: "border-amber-200 bg-amber-50 text-amber-800",
                  info: "border-slate-200 bg-slate-50 text-slate-700",
                  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
                }[item.tone];
                return (
                  <div key={index} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${styles}`}>
                    <div className="flex gap-3"><div className="mt-0.5">{item.tone === "critical" ? <XCircle className="h-4 w-4" /> : item.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div><div className="text-xs font-semibold">{item.title}</div><div className="mt-0.5 text-xs opacity-90">{item.text}</div></div></div>
                    {item.href && <Link href={item.href} className="shrink-0 text-xs font-semibold underline">Ouvrir</Link>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="border-slate-200 p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Actions rapides</h2><p className="mt-1 text-xs text-slate-500">Accès direct aux fonctions centrales.</p></div><Settings2 className="h-5 w-5 text-slate-400" /></div>
            <div className="mt-4 grid gap-2">
              <Link href="/admin/billing" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Paiements centraux</span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>
              <Link href="/admin/integration-checklist" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Checklist projets</span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>
              <Link href="/admin/trouvetou-traffic" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Trafic Trouvetou</span><ChevronRight className="h-4 w-4 text-slate-400" /></Link>
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm text-slate-500"><span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alertes externes</span><span className="text-[10px]">Telegram suspendu</span></div>
            </div>
          </Card>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div><h2 className="text-lg font-semibold">Projets</h2><p className="mt-1 text-xs text-slate-500">Cliquez sur un projet pour ouvrir son cockpit complet et isolé.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un projet…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 sm:w-56" /></div>
              <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none">
                <option value="all">Toutes les santés</option><option value="healthy">Sains</option><option value="warning">Attention</option><option value="critical">Critiques</option><option value="unknown">Inconnus</option>
              </select>
            </div>
          </div>
          {filteredProjects.length === 0 ? (
            <Card className="p-8 text-center"><Search className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm text-slate-500">Aucun projet ne correspond aux filtres.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} metric={metricByProject.get(project.id)} />)}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-200 p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Centre de supervision</h2><p className="mt-1 text-xs text-slate-500">Les alertes et signaux récents restent centralisés ici.</p></div><Bell className="h-5 w-5 text-slate-400" /></div>
            <div className="mt-4 space-y-2">
              {alerts.slice(0, 6).map((alert) => <div key={alert.id} className="flex gap-3 rounded-xl border p-3"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-slate-400">{alert.type}</div><div className="mt-0.5 break-words text-sm text-slate-700">{alert.message}</div><div className="mt-1 text-[10px] text-slate-400">{new Date(alert.created_at).toLocaleString("fr-FR")}</div></div></div>)}
              {alerts.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-500">Aucune alerte reçue.</div>}
            </div>
          </Card>

          <Card className="border-slate-200 p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">État de l'infrastructure</h2><p className="mt-1 text-xs text-slate-500">Indicateurs de confiance du hub.</p></div><Database className="h-5 w-5 text-slate-400" /></div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-xs">Réception métriques</span><Badge variant="outline">{metrics.length ? "Active" : "En attente"}</Badge></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-xs">Fraîcheur des données</span><Badge variant="outline">{staleProjects.length ? `${staleProjects.length} à vérifier` : "OK"}</Badge></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-xs">Paiements en attente</span><Badge variant="outline">{pendingPayments.length ? `${pendingPayments.length} action(s)` : "Aucun"}</Badge></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-xs">Alertes Telegram</span><Badge variant="outline">Hors service</Badge></div>
            </div>
          </Card>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Refontiq Control Center • Super Admin central uniquement</span>
          <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Actualisation automatique toutes les 30 secondes</span>
        </footer>
      </main>
    </div>
  );
}
