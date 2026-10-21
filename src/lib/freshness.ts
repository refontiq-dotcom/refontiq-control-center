// ============================================================================
// Fraîcheur des données — UNE SEULE source de vérité.
//
// Avant : le seuil « périmé » était codé en dur à 30 minutes à quatre endroits
// (intelligence, tableau de bord ×2, page projet), alors que les produits envoient
// leurs métriques toutes les heures ou une fois par jour : le Control Center
// affichait « synchronisation ancienne » presque en permanence.
//
// Règle : une donnée est « périmée » quand son âge dépasse DEUX fois la cadence
// d'envoi attendue du produit (une exécution manquée est tolérée, deux ne le sont pas).
// ============================================================================

export type DataConfidence = "fresh" | "stale" | "missing";

/** Cadence d'envoi attendue, en minutes, par produit. À mettre à jour avec le planificateur. */
export const EXPECTED_INTERVAL_MINUTES: Record<string, number> = {
  // Séjoura : envoi déclenché à la main tant que le planning horaire n'est pas réactivé.
  // Passer à 60 AVEC la réactivation du planning (.github/workflows/control-center-metrics.yml).
  sejoura: 24 * 60,
  schooly: 24 * 60, // cron quotidien
  trouvetou: 24 * 60,
  docly: 24 * 60,
};

export const DEFAULT_INTERVAL_MINUTES = 24 * 60;
const STALE_FACTOR = 2;

export function expectedIntervalMinutes(projet?: string | null): number {
  return (projet && EXPECTED_INTERVAL_MINUTES[projet]) || DEFAULT_INTERVAL_MINUTES;
}

/** Âge au-delà duquel la donnée d'un produit est considérée périmée. */
export function staleAfterMinutes(projet?: string | null): number {
  return expectedIntervalMinutes(projet) * STALE_FACTOR;
}

/** Âge en minutes ; `Infinity` si la date est absente ou invalide. */
export function syncAgeMinutes(value?: string | null, now: number = Date.now()): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - time) / 60_000);
}

export function dataConfidence(value?: string | null, projet?: string | null, now: number = Date.now()): DataConfidence {
  const age = syncAgeMinutes(value, now);
  if (!Number.isFinite(age)) return "missing";
  return age > staleAfterMinutes(projet) ? "stale" : "fresh";
}

export function isStale(value?: string | null, projet?: string | null, now: number = Date.now()): boolean {
  return dataConfidence(value, projet, now) !== "fresh";
}

/** « 45 minutes », « 3 heures », « 2 jours » — pour des messages lisibles. */
export function formatDuration(minutes: number): string {
  const n = Math.round(minutes);
  if (n < 120) return `${n} minute${n > 1 ? "s" : ""}`;
  const h = Math.round(n / 60);
  if (h < 48) return `${h} heures`;
  return `${Math.round(h / 24)} jours`;
}
