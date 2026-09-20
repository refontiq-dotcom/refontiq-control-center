export type IntelligenceSeverity = "info" | "warning" | "critical";
export type DataConfidence = "fresh" | "stale" | "missing";

export interface IntelligenceMetric {
  projet: string;
  nom: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: "healthy" | "warning" | "critical" | "unknown";
  derniere_synchro: string | null;
  details?: Record<string, unknown>;
}

export interface IntelligenceSnapshot {
  projet: string;
  mrr: number;
  comptes_actifs: number;
  statut_sante: IntelligenceMetric["statut_sante"];
  captured_at: string;
}

export interface IntelligenceItem {
  id: string;
  projet: string;
  kind: "anomaly" | "attention" | "recommendation" | "review";
  severity: IntelligenceSeverity;
  title: string;
  message: string;
  source: string;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export function syncAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 60_000);
}

export function dataConfidence(value?: string | null): DataConfidence {
  const age = syncAgeMinutes(value);
  if (!value || !Number.isFinite(age)) return "missing";
  if (age <= 30) return "fresh";
  return "stale";
}

export function buildDeterministicIntelligence(
  metrics: IntelligenceMetric[],
  snapshots: IntelligenceSnapshot[],
  payments: Array<{ id: string; produit: string; amount: number; created_at: string }>,
): IntelligenceItem[] {
  const items: IntelligenceItem[] = [];

  for (const metric of metrics) {
    const confidence = dataConfidence(metric.derniere_synchro);
    if (confidence === "missing") {
      items.push({
        id: `missing-${metric.projet}`,
        projet: metric.projet,
        kind: "attention",
        severity: "warning",
        title: "Aucune donnée reçue",
        message: `Aucune métrique actuelle n'est disponible pour ${metric.nom}.`,
        source: "portfolio_metrics",
        status: "open",
        created_at: new Date().toISOString(),
      });
    } else if (confidence === "stale") {
      items.push({
        id: `stale-${metric.projet}`,
        projet: metric.projet,
        kind: "attention",
        severity: "warning",
        title: "Synchronisation ancienne",
        message: `La dernière synchronisation de ${metric.nom} date de plus de 30 minutes.`,
        source: "portfolio_metrics.derniere_synchro",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }

    if (metric.statut_sante === "critical") {
      items.push({
        id: `critical-${metric.projet}`,
        projet: metric.projet,
        kind: "attention",
        severity: "critical",
        title: "État critique signalé",
        message: `${metric.nom} a transmis un état critique.`,
        source: "portfolio_metrics.statut_sante",
        status: "open",
        created_at: new Date().toISOString(),
      });
    } else if (metric.statut_sante === "warning") {
      items.push({
        id: `warning-${metric.projet}`,
        projet: metric.projet,
        kind: "attention",
        severity: "warning",
        title: "État à surveiller",
        message: `${metric.nom} a transmis un état nécessitant une attention.`,
        source: "portfolio_metrics.statut_sante",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }

    const previous = [...snapshots]
      .filter((s) => s.projet === metric.projet)
      .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())[0];

    if (previous && previous.comptes_actifs > 0 && metric.comptes_actifs === 0) {
      items.push({
        id: `drop-accounts-${metric.projet}`,
        projet: metric.projet,
        kind: "anomaly",
        severity: "warning",
        title: "Baisse d'activité détectée",
        message: `${metric.nom} est passé de ${previous.comptes_actifs} à 0 compte actif depuis le dernier instantané disponible.`,
        source: "portfolio_metric_snapshots",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }

    if (previous && previous.mrr > 0 && metric.mrr === 0) {
      items.push({
        id: `drop-mrr-${metric.projet}`,
        projet: metric.projet,
        kind: "anomaly",
        severity: "warning",
        title: "MRR en baisse",
        message: `${metric.nom} est passé de ${previous.mrr} FCFA à 0 FCFA depuis le dernier instantané disponible.`,
        source: "portfolio_metric_snapshots",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }
  }

  for (const payment of payments) {
    items.push({
      id: `payment-${payment.id}`,
      projet: payment.produit,
      kind: "attention",
      severity: "warning",
      title: "Paiement à traiter",
      message: `Un paiement de ${payment.amount.toLocaleString("fr-FR")} FCFA attend une décision centrale.`,
      source: "payment_validation_requests",
      status: "open",
      created_at: new Date().toISOString(),
    });
  }

  return items;
}
