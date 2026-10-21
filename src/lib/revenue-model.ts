// ============================================================================
// Modèle de revenu de chaque produit — ce que « MRR » veut dire, ou ne veut pas dire.
//
// Le MRR (revenu mensuel récurrent) n'a de sens que pour un produit vendu par abonnement.
// Avant ce fichier, le tableau de bord additionnait le champ `mrr` de TOUS les produits,
// donc des abonnements (Séjoura) avec des chiffres d'une autre nature (frais par inscription
// de Schooly, publicité de Trouvetou) : un total sans signification.
// Décisions du propriétaire : docs/architecture/control-center-vision.md §4.3.
// ============================================================================

export type RevenueKind = "recurring" | "per_event" | "advertising" | "unknown";

export interface RevenueModel {
  kind: RevenueKind;
  /** Libellé court affiché à la place du MRR pour un produit non récurrent. */
  label: string;
}

export const PRODUCT_REVENUE_MODEL: Record<string, RevenueModel> = {
  sejoura: { kind: "recurring", label: "Abonnements mensuels" },
  docly: { kind: "recurring", label: "Abonnements mensuels" },
  schooly: { kind: "per_event", label: "1 000 F par élève" },
  trouvetou: { kind: "advertising", label: "Publicité" },
};

export function revenueModel(projet?: string | null): RevenueModel {
  return (projet && PRODUCT_REVENUE_MODEL[projet]) || { kind: "unknown", label: "Modèle à définir" };
}

/** Seuls les produits à abonnement entrent dans le MRR. Un produit inconnu n'y entre PAS. */
export function isRecurringRevenue(projet?: string | null): boolean {
  return revenueModel(projet).kind === "recurring";
}

export function sumRecurringMrr(metrics: Array<{ projet: string; mrr: number }>): number {
  return metrics.reduce((sum, m) => (isRecurringRevenue(m.projet) ? sum + (Number(m.mrr) || 0) : sum), 0);
}

/** Variation de MRR ; `null` si le produit n'est pas à abonnement (la notion n'existe pas). */
export function mrrDelta(
  metric: { projet: string; mrr: number } | null | undefined,
  previous: { mrr: number } | null | undefined
): number | null {
  if (!metric || !previous || !isRecurringRevenue(metric.projet)) return null;
  return (Number(metric.mrr) || 0) - (Number(previous.mrr) || 0);
}

/**
 * MRR total par jour, produits à abonnement uniquement.
 * Pour un produit et un jour donnés, on retient le DERNIER instantané (pas la somme) :
 * avec plusieurs envois par jour, additionner multiplierait le MRR par le nombre d'envois.
 */
export function mrrTrendByDay(
  snapshots: Array<{ projet: string; mrr: number; captured_at: string }>
): Array<{ day: string; mrr: number }> {
  const latest = new Map<string, { at: number; mrr: number }>(); // clé = jour|projet
  for (const s of snapshots) {
    if (!isRecurringRevenue(s.projet)) continue;
    const at = new Date(s.captured_at ?? "").getTime();
    if (!Number.isFinite(at)) continue;
    const key = `${new Date(at).toISOString().slice(0, 10)}|${s.projet}`;
    const seen = latest.get(key);
    if (!seen || at > seen.at) latest.set(key, { at, mrr: Number(s.mrr) || 0 });
  }
  const byDay = new Map<string, number>();
  for (const [key, value] of latest) {
    const day = key.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + value.mrr);
  }
  return Array.from(byDay, ([day, mrr]) => ({ day, mrr })).sort((a, b) => a.day.localeCompare(b.day));
}
