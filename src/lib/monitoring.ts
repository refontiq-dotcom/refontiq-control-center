// ============================================================================
// Veilleur : détecte qu'un produit ne livre plus ses métriques ET prévient, sans attendre
// que quelqu'un ouvre le tableau de bord.
//
// Pourquoi : Séjoura est resté 3 semaines sans déploiement (24/09 → 18/10) et Schooly n'a rien
// envoyé depuis le 20/09 ; personne n'en a été informé. La fraîcheur était affichée, jamais
// notifiée.
//
// Ce module est PUR (aucune E/S) : évaluation des constats, puis décision de notification
// (anti-doublon, escalade, retour à la normale). La route qui l'utilise fait les envois.
// ============================================================================
import { formatDuration, staleAfterMinutes, syncAgeMinutes, expectedIntervalMinutes } from "@/lib/freshness";

/**
 * Produits SURVEILLÉS : ceux dont l'envoi automatique est en place. Ajouter un produit ici
 * seulement quand il envoie réellement (sinon l'alerte serait permanente et sans valeur).
 */
export const MONITORED_PROJECTS = ["sejoura", "schooly"] as const;

const NAMES: Record<string, string> = { sejoura: "Séjoura", schooly: "Schooly", docly: "Docly", trouvetou: "Trouvetou" };

export type FindingKind = "missing" | "stale" | "unhealthy";
export type Severity = "warning" | "critical";

export interface MetricRow {
  projet: string;
  nom?: string | null;
  statut_sante?: string | null;
  derniere_synchro?: string | null;
}

export interface Finding {
  projet: string;
  kind: FindingKind;
  severity: Severity;
  title: string;
  message: string;
  /** Identifiant stable du constat (sert d'anti-doublon). */
  key: string;
}

export interface HistoryRow {
  type: string;
  created_at: string;
  status?: string | null;
}

export interface Notification {
  type: string;
  level: "warning" | "critical" | "success";
  title: string;
  message: string;
}

export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ESCALATION_FACTOR = 3; // périmé depuis plus de 3 × le délai toléré → critique

const keyOf = (projet: string, kind: string, severity: string) => `monitor:${projet}:${kind}:${severity}`;

export function evaluateMonitoring(
  metrics: MetricRow[],
  now: number = Date.now(),
  monitored: readonly string[] = MONITORED_PROJECTS
): Finding[] {
  const findings: Finding[] = [];
  for (const projet of monitored) {
    const row = metrics.find((m) => m.projet === projet);
    const name = row?.nom || NAMES[projet] || projet;
    const age = row ? syncAgeMinutes(row.derniere_synchro, now) : Number.POSITIVE_INFINITY;

    if (!row || !Number.isFinite(age)) {
      findings.push({
        projet, kind: "missing", severity: "critical", key: keyOf(projet, "missing", "critical"),
        title: `${name} : aucune donnée reçue`,
        message: `Le Control Center n'a jamais reçu de métriques exploitables de ${name}. Vérifiez l'envoi (variable CONTROL_CENTER_URL, secret METRICS_PUSH_SECRET, planification).`,
      });
      continue;
    }

    const limit = staleAfterMinutes(projet);
    if (age > limit) {
      const severity: Severity = age > limit * ESCALATION_FACTOR ? "critical" : "warning";
      findings.push({
        projet, kind: "stale", severity, key: keyOf(projet, "stale", severity),
        title: `${name} : plus de nouvelles depuis ${formatDuration(age)}`,
        message: `Dernier envoi il y a ${formatDuration(age)} (cadence attendue : ${formatDuration(expectedIntervalMinutes(projet))}, alerte au-delà de ${formatDuration(limit)}). Vérifiez le déploiement et la planification de ${name}.`,
      });
    }

    if (row.statut_sante === "critical") {
      findings.push({
        projet, kind: "unhealthy", severity: "critical", key: keyOf(projet, "unhealthy", "critical"),
        title: `${name} : état critique`,
        message: `${name} signale lui-même un état critique dans ses dernières métriques.`,
      });
    }
  }
  return findings;
}

/**
 * Décide quoi envoyer :
 *  - un constat déjà notifié dans les 24 h n'est pas renotifié (les tentatives en échec ne comptent pas) ;
 *  - une aggravation (warning → critical) change de clé, donc notifie à nouveau ;
 *  - quand un produit n'a plus aucun constat alors que sa dernière alerte n'était pas un
 *    « retour à la normale », on le dit une fois.
 */
export function planNotifications(
  findings: Finding[],
  history: HistoryRow[],
  now: number = Date.now(),
  monitored: readonly string[] = MONITORED_PROJECTS
): { toSend: Notification[]; skippedDuplicates: number } {
  const toSend: Notification[] = [];
  let skippedDuplicates = 0;
  const delivered = history.filter((h) => h.status !== "failed");

  for (const f of findings) {
    const duplicate = delivered.some((h) => h.type === f.key && now - new Date(h.created_at).getTime() < DEDUP_WINDOW_MS);
    if (duplicate) { skippedDuplicates++; continue; }
    toSend.push({ type: f.key, level: f.severity, title: f.title, message: f.message });
  }

  for (const projet of monitored) {
    if (findings.some((f) => f.projet === projet)) continue;
    const last = delivered
      .filter((h) => h.type.startsWith(`monitor:${projet}:`))
      // Plus récent d'abord ; à horodatage ÉGAL, le « retour à la normale » est forcément postérieur
      // à l'incident qu'il clôt (il n'est émis qu'après lui) : il l'emporte.
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
          Number(b.type.endsWith(":recovered")) - Number(a.type.endsWith(":recovered"))
      )[0];
    if (last && !last.type.endsWith(":recovered")) {
      const name = NAMES[projet] || projet;
      toSend.push({
        type: `monitor:${projet}:recovered`, level: "success",
        title: `${name} : de nouveau à jour`,
        message: `${name} envoie de nouveau ses métriques normalement.`,
      });
    }
  }
  return { toSend, skippedDuplicates };
}
