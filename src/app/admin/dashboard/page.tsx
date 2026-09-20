"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/utils";
import { ICON_MAP, REFONTIQ_PROJECTS, type RefontiqProject } from "@/lib/projects";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Database,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { ADMIN_LOGIN_ROUTE } from "@/lib/routes";
import { AdminPeriodFilter, getPresetRange, type PeriodRange } from "@/components/admin-period-filter";
import { AdminNotifications } from "@/components/admin-notifications";
import {
  AreaChart,
  DonutChart,
  GroupedBars,
  MiniSparkline,
  RoundProgress,
  formatCompact,
} from "@/components/admin-dash-charts";

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

interface Snapshot {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: Health;
  captured_at: string;
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

const PROJECT_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  ...ICON_MAP,
  LayoutDashboard,
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
    healthy: { label: "Sain", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    warning: { label: "Attention", className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    critical: { label: "Critique", className: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
    unknown: { label: "Inconnu", className: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  }[health];
}

function syncAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 60_000) : Number.POSITIVE_INFINITY;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "blue",
  progress,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: "blue" | "indigo" | "emerald" | "amber" | "red";
  progress?: number;
}) {
  const tones: Record<string, { tile: string; ring: string }> = {
    blue: { tile: "bg-blue-600/10 text-blue-600", ring: "ring-blue-100" },
    indigo: { tile: "bg-indigo-600/10 text-indigo-600", ring: "ring-indigo-100" },
    emerald: { tile: "bg-emerald-600/10 text-emerald-600", ring: "ring-emerald-100" },
    amber: { tile: "bg-amber-500/10 text-amber-600", ring: "ring-amber-100" },
    red: { tile: "bg-red-600/10 text-red-600", ring: "ring-red-100" },
  };
  const t = tones[tone];

  return (
    <div className={`soft-card flex items-center gap-4 rounded-3xl border border-white/70 bg-white/80 p-4 ring-1 ${t.ring}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${t.tile}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</div>
      </div>
      {typeof progress === "number" && (
        <RoundProgress value={progress} size={46} stroke={5} color="#2563eb" label={`${Math.round(progress)}%`} />
      )}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`soft-card rounded-3xl border-white/70 bg-white/80 p-5 backdrop-blur ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 text-slate-500">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function ProjectCard({ project, metric }: { project: RefontiqProject; metric?: PortfolioMetric }) {
  const health = healthMeta(metric?.statut_sante ?? "unknown");
  const stale = syncAgeMinutes(metric?.derniere_synchro) > 30;

  return (
    <Link href={`/admin/projects/${project.id}`} className="block h-full">
      <Card className="soft-card group h-full overflow-hidden rounded-3xl border-white/70 bg-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${project.accent}, ${project.accent}55)` }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${project.accent}14`, color: project.accent }}
              >
                <ProjectIcon iconName={project.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">{project.name}</h3>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${health.dot}`} />
                </div>
                <p className="truncate text-xs text-slate-500">{project.tagline}</p>
              </div>
            </div>
            <Badge variant="outline" className={`shrink-0 ${health.className}`}>{health.label}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50/80 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Comptes</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{metric ? metric.comptes_actifs.toLocaleString("fr-FR") : "—"}</div>
            </div>
            <div className="rounded-2xl bg-slate-50/80 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">MRR</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{metric ? formatFCFA(metric.mrr) : "—"}</div>
            </div>
            <div className="rounded-2xl bg-slate-50/80 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Sync</div>
              <div className={`mt-1 text-[11px] font-medium ${stale ? "text-amber-700" : "text-emerald-700"}`}>
                {metric ? formatRelative(metric.derniere_synchro) : "Aucune"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{project.statusLabel ?? "Projet"}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
              Voir le cockpit <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
            </span>
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
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | Health>("all");
  const [period, setPeriod] = useState<PeriodRange>(() => getPresetRange("30d"));

  const loadData = useCallback(async (silent = false) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }

      setMetricsStatus("chargement");
      const params = new URLSearchParams({ from: period.from, to: period.to });
      const res = await fetch(`/api/admin/overview?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Lecture impossible");

      setMetrics(body.metrics ?? []);
      setSnapshots(body.snapshots ?? []);
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
  }, [period.from, period.to]);

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
  const healthyProjects = metrics.filter((m) => m.statut_sante === "healthy").length;
  const healthRatio = metrics.length ? (healthyProjects / metrics.length) * 100 : 0;

  const projectAccent = useMemo(
    () => new Map(REFONTIQ_PROJECTS.map((p) => [p.id, p.accent])),
    []
  );

  const donutData = useMemo(
    () => metrics
      .filter((m) => m.mrr > 0)
      .map((m) => ({
        label: m.nom,
        value: m.mrr,
        color: projectAccent.get(m.projet) ?? "#2563eb",
      })),
    [metrics, projectAccent]
  );

  const trendValues = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const snapshot of snapshots) {
      const day = (snapshot.captured_at ?? "").slice(0, 10);
      if (!day) continue;
      byDay.set(day, (byDay.get(day) ?? 0) + Number(snapshot.mrr || 0));
    }
    const series = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value);
    if (series.length >= 2) return series.slice(-16);
    return metrics.map((m) => m.mrr);
  }, [snapshots, metrics]);

  const earliestByProject = useMemo(() => {
    const map = new Map<string, Snapshot>();
    const ordered = [...snapshots].sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? ""));
    for (const snapshot of ordered) {
      if (!map.has(snapshot.projet)) map.set(snapshot.projet, snapshot);
    }
    return map;
  }, [snapshots]);

  const grouped = useMemo(() => {
    const groups = metrics.map((m) => m.nom);
    return {
      groups,
      series: [
        { label: "Comptes (début période)", color: "#c7d2fe", values: metrics.map((m) => earliestByProject.get(m.projet)?.comptes_actifs ?? m.comptes_actifs) },
        { label: "Comptes (actuels)", color: "#2563eb", values: metrics.map((m) => m.comptes_actifs) },
      ],
    };
  }, [metrics, earliestByProject]);

  const insights = useMemo(() => {
    const items: Array<{ tone: "critical" | "warning" | "info" | "success"; title: string; text: string; href?: string }> = [];
    if (criticalProjects.length) items.push({ tone: "critical", title: "Action prioritaire", text: `${criticalProjects.length} projet(s) signalent un état critique.`, href: "/admin/integration-checklist" });
    if (staleProjects.length) items.push({ tone: "warning", title: "Synchronisation à vérifier", text: `${staleProjects.length} projet(s) n'ont pas synchronisé leurs métriques depuis plus de 30 minutes.` });
    if (pendingPayments.length) items.push({ tone: "warning", title: "Validation financière", text: `${pendingPayments.length} paiement(s) attendent une décision pour ${formatFCFA(pendingAmount)}.`, href: "/admin/finance" });
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
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-full text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/30 lg:hidden">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                <Activity className="h-3.5 w-3.5" /> Centre de pilotage
              </div>
              <h1 className="text-lg font-bold tracking-tight">Vue globale de Refontiq</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-slate-500 md:inline">
              {lastSyncAt ? `Synchronisé ${formatRelative(lastSyncAt)}` : "Synchronisation…"}
            </span>
            <AdminNotifications />
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/70 bg-white/80 px-3 text-xs font-semibold text-slate-700 soft-chip transition hover:bg-white"
            >
              <RefreshCw className={`h-4 w-4 ${metricsStatus === "chargement" ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Déconnexion"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 py-6 md:px-7">
        {/* HERO */}
        <section className="soft-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1c33] via-[#13294b] to-[#1d4ed8] p-6 text-white md:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-blue-200/90">
                <Sparkles className="h-3.5 w-3.5" /> Revenu récurrent consolidé
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <span className="text-4xl font-bold tracking-tight md:text-5xl">{formatFCFA(mrr)}</span>
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-blue-100 ring-1 ring-white/15">
                  <ArrowUpRight className="h-3 w-3" /> {metrics.length} produit(s) connecté(s)
                </span>
              </div>
              <p className="mt-3 max-w-xl text-sm text-blue-100/80">
                Une seule console pour surveiller les produits, détecter les situations à traiter, centraliser les paiements et suivre l&apos;intégration.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-blue-200/80"><Users className="h-3.5 w-3.5" /> Comptes actifs</div>
                  <div className="mt-1.5 text-xl font-semibold">{activeAccounts.toLocaleString("fr-FR")}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-blue-200/80"><Building2 className="h-3.5 w-3.5" /> Produits actifs</div>
                  <div className="mt-1.5 text-xl font-semibold">{REFONTIQ_PROJECTS.filter((p) => p.status === "active").length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-blue-200/80"><Wallet className="h-3.5 w-3.5" /> Paiements</div>
                  <div className="mt-1.5 text-xl font-semibold">{pendingPayments.length}</div>
                </div>
              </div>

              {trendValues.length > 1 && (
                <div className="mt-5 flex items-center gap-4">
                  <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-blue-200/70">Tendance du MRR</div>
                    <MiniSparkline id="hero-mrr" values={trendValues} width={240} height={54} stroke="#ffffff" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/admin/finance" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                <CreditCard className="h-4 w-4 text-blue-200" />
                <div className="mt-2.5 text-sm font-semibold">{pendingPayments.length ? `${pendingPayments.length} en attente` : "À jour"}</div>
                <div className="text-[10px] text-blue-200/70">Paiements centraux</div>
              </Link>
              <Link href="/admin/integration-checklist" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                <CheckCircle2 className="h-4 w-4 text-blue-200" />
                <div className="mt-2.5 text-sm font-semibold">Suivi</div>
                <div className="text-[10px] text-blue-200/70">Intégration projets</div>
              </Link>
              <Link href="/admin/trouvetou-traffic" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                <TrendingUp className="h-4 w-4 text-blue-200" />
                <div className="mt-2.5 text-sm font-semibold">Trafic</div>
                <div className="text-[10px] text-blue-200/70">Trouvetou</div>
              </Link>
              <Link href="/admin/supervision" className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                <Zap className="h-4 w-4 text-blue-200" />
                <div className="mt-2.5 text-sm font-semibold">Supervision</div>
                <div className="text-[10px] text-blue-200/70">Signaux temps réel</div>
              </Link>
            </div>
          </div>
        </section>

        <AdminPeriodFilter value={period} onChange={setPeriod} onReset={() => setPeriod(getPresetRange("30d"))} />

        {/* KPI */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Comptes actifs"
            value={activeAccounts.toLocaleString("fr-FR")}
            hint="sur la période sélectionnée"
            tone="blue"
          />
          <StatCard
            icon={Wallet}
            label="MRR consolidé"
            value={formatFCFA(mrr)}
            hint="données reçues des produits"
            tone="indigo"
          />
          <StatCard
            icon={AlertTriangle}
            label="Santé du parc"
            value={`${healthyProjects}/${metrics.length || 0}`}
            hint={criticalProjects.length ? `${criticalProjects.length} critique(s)` : "aucun critique"}
            tone={criticalProjects.length ? "red" : "emerald"}
            progress={healthRatio}
          />
          <StatCard
            icon={CreditCard}
            label="Paiements en attente"
            value={String(pendingPayments.length)}
            hint={pendingPayments.length ? formatFCFA(pendingAmount) : "aucune action"}
            tone={pendingPayments.length ? "amber" : "emerald"}
          />
        </section>

        {/* CHARTS ROW 1 */}
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <SectionCard
            title="Évolution du MRR"
            subtitle="Revenu consolidé reconstruit à partir des snapshots reçus."
            icon={TrendingUp}
          >
            {trendValues.length > 1 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{formatFCFA(mrr)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Cumul actuel des produits connectés</div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <TrendingUp className="h-3.5 w-3.5" /> {trendValues.length} points
                  </div>
                </div>
                <AreaChart id="mrr-area" values={trendValues} stroke="#2563eb" height={130} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                Pas encore assez d&apos;historique pour tracer l&apos;évolution du MRR.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Répartition du MRR" subtitle="Part de chaque produit dans le revenu." icon={LayoutDashboard}>
            {donutData.length ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
                <DonutChart data={donutData} centerValue={formatCompact(mrr)} centerLabel="MRR FCFA" />
                <div className="w-full max-w-[200px] space-y-2">
                  {donutData.map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.label}
                      </span>
                      <span className="font-semibold text-slate-900">{Math.round((d.value / (donutData.reduce((s, x) => s + x.value, 0) || 1)) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                Aucun revenu transmis sur la période.
              </div>
            )}
          </SectionCard>
        </section>

        {/* CHARTS ROW 2 */}
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <SectionCard title="Base de comptes par produit" subtitle="Comparaison début de période vs aujourd'hui." icon={Users}>
            {grouped.groups.length ? (
              <GroupedBars groups={grouped.groups} series={grouped.series} height={190} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                Aucun compte actif rapporté pour le moment.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Objectifs de disponibilité" subtitle="Part de produits en état sain." icon={Activity}>
            <div className="flex items-center gap-5">
              <RoundProgress value={healthRatio} size={92} stroke={9} color="#10b981" label={`${Math.round(healthRatio)}%`} />
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {healthyProjects} sain(s)</div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {warningProjects.length} attention</div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {criticalProjects.length} critique(s)</div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> {staleProjects.length} sync à vérifier</div>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* SUPERVISION + QUICK ACTIONS */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <SectionCard title="Supervision opérationnelle" subtitle="Priorités calculées à partir des données réellement reçues." icon={Activity}>
            <div className="space-y-2">
              {insights.map((item, index) => {
                const styles = {
                  critical: "border-red-200 bg-red-50/70 text-red-800",
                  warning: "border-amber-200 bg-amber-50/70 text-amber-800",
                  info: "border-slate-200 bg-slate-50 text-slate-700",
                  success: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
                }[item.tone];
                return (
                  <div key={index} className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 ${styles}`}>
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {item.tone === "critical" ? <XCircle className="h-4 w-4" /> : item.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{item.title}</div>
                        <div className="mt-0.5 text-xs opacity-90">{item.text}</div>
                      </div>
                    </div>
                    {item.href && <Link href={item.href} className="shrink-0 text-xs font-semibold underline underline-offset-2">Ouvrir</Link>}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Actions rapides" subtitle="Accès direct aux fonctions centrales." icon={Zap}>
            <div className="grid gap-2">
              {[
                { href: "/admin/finance", icon: CreditCard, label: "Paiements centraux" },
                { href: "/admin/integration-checklist", icon: CheckCircle2, label: "Checklist projets" },
                { href: "/admin/trouvetou-traffic", icon: TrendingUp, label: "Trafic Trouvetou" },
                { href: "/admin/supervision", icon: Activity, label: "Supervision temps réel" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 p-3 text-sm font-medium text-slate-700 transition hover:border-blue-100 hover:bg-white"
                >
                  <span className="flex items-center gap-2.5"><action.icon className="h-4 w-4 text-blue-600" /> {action.label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-400">
                <span className="flex items-center gap-2.5"><Bell className="h-4 w-4" /> Alertes externes</span>
                <span className="text-[10px]">Telegram suspendu</span>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* PROJECTS */}
        <section>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Produits Refontiq</h2>
              <p className="mt-1 text-xs text-slate-500">Cliquez sur un produit pour ouvrir son cockpit complet et isolé.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un produit…"
                  className="h-9 w-full rounded-full border border-white/70 bg-white/80 pl-9 pr-3 text-sm soft-chip outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 sm:w-56"
                />
              </div>
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)}
                className="h-9 rounded-full border border-white/70 bg-white/80 px-3 text-sm soft-chip outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Toutes les santés</option>
                <option value="healthy">Sains</option>
                <option value="warning">Attention</option>
                <option value="critical">Critiques</option>
                <option value="unknown">Inconnus</option>
              </select>
            </div>
          </div>
          {filteredProjects.length === 0 ? (
            <Card className="soft-card rounded-3xl border-white/70 bg-white/80 p-8 text-center">
              <Search className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Aucun produit ne correspond aux filtres.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} metric={metricByProject.get(project.id)} />)}
            </div>
          )}
        </section>

        {/* ALERTS + INFRA */}
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="Centre de supervision" subtitle="Les alertes et signaux récents restent centralisés ici." icon={Bell}>
            <div className="space-y-2">
              {alerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{alert.type}</div>
                    <div className="mt-0.5 break-words text-sm text-slate-700">{alert.message}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{new Date(alert.created_at).toLocaleString("fr-FR")}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">Aucune alerte reçue.</div>}
            </div>
          </SectionCard>

          <SectionCard title="État de l'infrastructure" subtitle="Indicateurs de confiance du hub." icon={Database}>
            <div className="space-y-2.5">
              {[
                { label: "Réception métriques", value: metrics.length ? "Active" : "En attente" },
                { label: "Fraîcheur des données", value: staleProjects.length ? `${staleProjects.length} à vérifier` : "OK" },
                { label: "Paiements en attente", value: pendingPayments.length ? `${pendingPayments.length} action(s)` : "Aucun" },
                { label: "Alertes Telegram", value: "Hors service" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50/80 p-3">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <Badge variant="outline" className="border-white/70 bg-white/80 text-slate-700">{row.value}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/60 pt-4 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Refontiq Control Center • Super Admin central uniquement</span>
          <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Actualisation automatique toutes les 30 secondes</span>
        </footer>
      </main>
    </div>
  );
}
