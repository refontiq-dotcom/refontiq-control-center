"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFCFA } from "@/lib/utils";
import {
  REFONTIQ_PROJECTS,
  type RefontiqProject,
} from "@/lib/projects";
import {
  Loader2,
  ShieldCheck,
  LogOut,
  RefreshCw,
  ArrowRight,
  Bell,
  TrendingUp,
  Users,
  Wallet,
  Building2,
  BedDouble,
  Stethoscope,
  GraduationCap,
  Clock3,
} from "lucide-react";
import {
  ADMIN_LOGIN_ROUTE,
} from "@/lib/routes";

const POLL_INTERVAL_MS = 30_000;

type MetricsStatus = "synchronisation" | "chargement" | "erreur";

interface PortfolioMetric {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: string;
  derniere_synchro: string;
}

interface PendingPayment {
  id: string;
  product_id: string;
  project_label?: string;
  tenant_name?: string;
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

const PROJECT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  BedDouble,
  Stethoscope,
  GraduationCap,
};

function ProjectIcon({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = PROJECT_ICON_MAP[iconName] || ShieldCheck;
  return <Icon className={className} />;
}

function formatRelativeSync(value?: string | null) {
  if (!value) return "Jamais synchronisé";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Date invalide";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "à l'instant";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function getSyncState(value?: string | null) {
  if (!value) return { label: "Jamais synchronisé", className: "text-slate-500" };
  const ageMinutes = (Date.now() - new Date(value).getTime()) / 60_000;
  if (!Number.isFinite(ageMinutes)) return { label: "Date invalide", className: "text-slate-500" };
  if (ageMinutes <= 10) return { label: "Synchro récente", className: "text-emerald-600" };
  if (ageMinutes <= 30) return { label: "Synchro ancienne", className: "text-amber-600" };
  return { label: "Synchro expirée", className: "text-red-600" };
}

function ProjectCardCompact({ project, metrics }: { project: RefontiqProject; metrics: PortfolioMetric[] }) {
  const projectMetrics = metrics.find((m) => m.projet === project.id);
  const healthColor = {
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200",
    unknown: "bg-slate-100 text-slate-600 border-slate-200",
  }[projectMetrics?.statut_sante ?? "unknown"];
  const healthLabel = {
    healthy: "Sain",
    warning: "Attention",
    critical: "Critique",
    unknown: "Inconnu",
  }[projectMetrics?.statut_sante ?? "unknown"];
  const syncState = getSyncState(projectMetrics?.derniere_synchro);

  return (
    <Card className="p-4 flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${project.accent}1A`, color: project.accent }}
      >
        <ProjectIcon iconName={project.icon} className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Link href={project.href} className="text-sm font-medium text-slate-900 hover:underline">
            {project.name}
          </Link>
          {project.status === "active" ? (
            <Badge variant="success">{project.statusLabel ?? "Actif"}</Badge>
          ) : (
            <Badge variant="outline">{project.statusLabel ?? "Bientôt"}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {projectMetrics !== undefined ? projectMetrics.comptes_actifs : "—"}
          </span>
          <span className="flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            {projectMetrics !== undefined ? formatFCFA(projectMetrics.mrr) : "—"}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] mt-2 ${syncState.className}`}>
          <Clock3 className="w-3 h-3" />
          <span>{syncState.label} • {formatRelativeSync(projectMetrics?.derniere_synchro)}</span>
        </div>
      </div>
      <Badge className={healthColor}>{healthLabel}</Badge>
    </Card>
  );
}


export default function SuperAdminHubPage() {
  const [loading, setLoading] = useState(true);
  const [metricsStatus, setMetricsStatus] = useState<MetricsStatus>("synchronisation");
  const [metrics, setMetrics] = useState<PortfolioMetric[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metricsFetched, setMetricsFetched] = useState(false);
  const [telegramTested, setTelegramTested] = useState(false);
  const [lastDemoAlert, setLastDemoAlert] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<"polling" | "manual">("polling");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = ADMIN_LOGIN_ROUTE;
        return;
      }
      setMetricsStatus("chargement");
      const supabaseAdmin = createAdminClient();

      const [{ data: metricsData }, { data: paymentsData }, { data: alertsData }] = await Promise.all([
        supabaseAdmin.from("portfolio_metrics").select("*").order("nom"),
        supabaseAdmin.from("subscription_payment_requests")
          .select("id,product_id,tenant_id,amount,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(25),
        supabaseAdmin.from("telegram_alerts")
          .select("id,type,message,created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setMetrics(metricsData || []);
      if (metricsData && metricsData.length) setMetricsFetched(true);
      setLastSyncAt(new Date().toISOString());
      setPendingPayments(
        ((paymentsData || []).map((p: any) => {
          const project = REFONTIQ_PROJECTS.find((pr) => pr.id === p.product_id);
          return { ...p, project_label: project?.name, tenant_name: undefined };
        })),
      );
      setAlerts(alertsData || []);
    } catch {
      setMetricsStatus("erreur");
      if (!silent) toast.error("Oups, les données n'ont pas pu se charger... Réessayez 🔄");
    } finally {
      setLoading(false);
      if (!silent) setMetricsStatus((current) => current === "erreur" ? "erreur" : "synchronisation");
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setMetricsStatus("chargement");
    try {
      await loadData(true);
      setMetricsFetched(true);
      setLastSyncAt(new Date().toISOString());
    } finally {
      setMetricsStatus("synchronisation");
    }
  }, [loadData]);

  const handleTelegramTest = useCallback(async () => {
    setMetricsStatus("chargement");
    try {
      const res = await fetch("/api/demo-alert", { method: "POST" });
      if (!res.ok) throw new Error("impossible");
      setTelegramTested(true);
      setLastDemoAlert("Test alerte démo créée (" + new Date().toLocaleTimeString() + ")");
      toast.success("Alerte démo envoyée.");
      await loadData(true);
    } catch {
      toast.error("Impossible de créer l'alarme démo.");
    } finally {
      setMetricsStatus("synchronisation");
    }
  }, [loadData]);

  const handleRescan = useCallback(async () => {
    setMetricsStatus("chargement");
    try {
      const res = await fetch("/api/resync-metrics", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "impossible");
      setLastSyncAt(new Date().toISOString());
      toast.success("Resynchronisation demandée (" + data.ref + ").");
      await loadData(true);
    } catch {
      toast.error("Impossible de déclencher la ré 동기화.");
    } finally {
      setMetricsStatus("synchronisation");
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
    const id = setInterval(() => loadData(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadData]);

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
    }
    window.location.href = ADMIN_LOGIN_ROUTE;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-color,#0C1C33)]" />
      </div>
    );
  }

  const activeProjects = REFONTIQ_PROJECTS.filter((p) => p.status === "active");

  const globalActiveAccounts = metrics.reduce((s, m) => s + m.comptes_actifs, 0);
  const globalMrr = metrics.reduce((s, m) => s + m.mrr, 0);
  const globalProjects = metrics.length;
  const recentAlerts = alerts.slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b bg-white dark:bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--primary-color,#0C1C33)]" />
            <span className="font-semibold text-slate-900 dark:text-white">Refontiq Control Center</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Super Admin • {new Date().toLocaleString("fr-FR")}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${metricsStatus === "chargement" ? "animate-spin" : ""}`} />
              {metricsStatus === "chargement" ? "Mise à jour…" : "Actualiser"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Écosystème */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Écosystème</h2>
            <div className="text-xs text-slate-500">
              {metricsStatus === "chargement"
                ? "Synchronisation…"
                : metricsStatus === "erreur"
                  ? "Erreur de synchronisation"
                  : lastSyncAt
                    ? `Dernière consultation : ${formatRelativeSync(lastSyncAt)}`
                    : "En attente de synchronisation"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Comptes actifs</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {globalActiveAccounts.toLocaleString("fr-FR")}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-medium">MRR consolidé</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatFCFA(globalMrr)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Projets actifs</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {globalProjects}
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-slate-600">Dernières alertes</span>
          </div>

          {recentAlerts.length === 0 ? (
            <Card className="p-4">
              <div className="text-sm text-slate-500">Aucune alerte récente.</div>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((a) => (
                <Card key={a.id} className="p-3 flex items-start gap-3">
                  <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500">{a.type}</div>
                    <div className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 break-words">{a.message}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-6 mb-3">
            <span className="text-sm font-medium text-slate-700">Produits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REFONTIQ_PROJECTS.map((project) => (
              <ProjectCardCompact key={project.id} project={project} metrics={metrics} />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Santé = état déclaré par le produit. La fraîcheur est calculée à partir de sa dernière synchronisation.
            Une synchronisation de plus de 30 minutes est signalée comme expirée.
          </p>

          {activeProjects.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-slate-700">Accès aux consoles</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium text-slate-700 hover:bg-slate-100"
                    style={{ borderColor: `${project.accent}40`, color: project.accent }}
                  >
                    Ouvrir {project.name}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Réglages */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Réglages</h2>
            <span className="text-xs text-slate-500">Paramètres globaux du Super Admin</span>
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Liens d'administration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REFONTIQ_PROJECTS.filter((p) => p.status === "active").map((project) => (
                <div key={project.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{project.name}</div>
                    <div className="text-xs text-slate-500">{project.tagline}</div>
                  </div>
                  <a
                    href={project.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                  >
                    Ouvrir la console
                  </a>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                État des connecteurs
              </h3>
              <span className="text-xs text-slate-500">
                Les secrets sont gérés localement par chaque produit.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    Métr. centralisées
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {metricsStatus === "chargement"
                      ? "En consultation…"
                      : metricsFetched
                      ? "Configuré"
                      : "Non configuré"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Chaque produit pousse ses métriques via sa propre clé partagée.
                  Le Control Center reçoit uniquement les données consolidées.
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    Alertes Telegram
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {telegramTested ? "Testé" : "Non testé"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Chaque produit configure son propre bot et son propre chat.
                  Le Control Center n’expose pas les tokens.
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    Webhook Wave
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Non configuré
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Prévu pour une phase ultérieure (dépend de l’API Wave).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4">
              <Button variant="outline" onClick={handleRefresh} className="gap-1">
                <RefreshCw className="w-4 h-4" />
                Ré-synchroniser les métriques
              </Button>
              <Button variant="outline" onClick={handleTelegramTest} className="gap-1">
                <Bell className="w-4 h-4" />
                Test alerte démo
              </Button>
            </div>

            {lastDemoAlert && (
              <p className="mt-3 text-xs text-slate-500">
                Dernière alerte démo : {lastDemoAlert}
              </p>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
