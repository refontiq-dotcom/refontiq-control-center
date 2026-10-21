import { z } from "zod";

// ============================================================================
// Contrat « métriques » v1 — POST /api/metrics/push
// Voir docs/contracts/metrics-push-v1.md (définition de chaque champ).
// ============================================================================

/** Produits connus. Liste fermée, volontairement : voir « Ajouter un SaaS » dans la doc. */
export const PROJECTS = ["sejoura", "schooly", "docly", "trouvetou"] as const;
export const HEALTH = ["healthy", "warning", "critical", "unknown"] as const;
export const ENVIRONMENTS = ["production", "preview", "development"] as const;

/** Taille maximale du corps de requête (octets). */
export const MAX_BODY_BYTES = 64 * 1024;
/** Taille maximale de `details` une fois sérialisé (octets). */
export const MAX_DETAILS_BYTES = 16 * 1024;
/** Profondeur maximale de `details`. */
export const MAX_DETAILS_DEPTH = 3;
/** Tolérance d'horloge : une collecte « dans le futur » au-delà est refusée. */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Au-delà, la donnée n'est plus considérée comme actuelle : refusée. */
export const MAX_AGE_MS = 72 * 60 * 60 * 1000;

const MAX_INT = 2_000_000_000; // colonne INTEGER côté base

const intField = z.number().int().nonnegative().max(MAX_INT);

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string().max(500),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValue).max(50),
    z.record(z.string().max(64), jsonValue),
  ])
);
const detailsSchema = z.record(z.string().max(64), jsonValue);

const baseFields = {
  projet: z.enum(PROJECTS),
  nom: z.string().trim().min(1).max(100),
  statut_sante: z.enum(HEALTH).optional(),
  details: detailsSchema.optional(),
};

/** v1 : tous les champs de provenance sont obligatoires. */
export const metricsPayloadV1 = z.object({
  contract_version: z.literal(1),
  environment: z.enum(ENVIRONMENTS),
  collected_at: z.iso.datetime({ offset: true }),
  run_id: z.uuid(),
  mrr: intField.optional(),
  comptes_actifs: intField.optional(),
  ...baseFields,
});

/** Chaîne numérique tolérée pour les anciens émetteurs (jamais "", ni booléen). */
const legacyInt = z
  .union([intField, z.string().regex(/^\d{1,10}$/).transform(Number).pipe(intField)])
  .optional();

/** Ancien format (sans contract_version) : accepté, mais signalé « legacy ». */
export const metricsPayloadLegacy = z.object({
  timestamp: z.iso.datetime({ offset: true }).optional(),
  mrr: legacyInt,
  comptes_actifs: legacyInt,
  ...baseFields,
});

export type NormalizedMetrics = {
  contractVersion: 0 | 1;
  projet: (typeof PROJECTS)[number];
  nom: string;
  environment: (typeof ENVIRONMENTS)[number];
  /** Date de COLLECTE côté émetteur (ou de réception si l'émetteur n'en fournit pas). */
  collectedAt: Date;
  collectedAtSource: "sender" | "received";
  runId: string | null;
  statut_sante?: (typeof HEALTH)[number];
  mrr?: number;
  comptes_actifs?: number;
  details?: Record<string, unknown>;
};

export type Issue = { path: string; message: string };
export type ParseResult =
  | { ok: true; data: NormalizedMetrics }
  | { ok: false; code: "invalid_payload" | "invalid_details"; issues: Issue[] };

function depthOf(value: unknown, level = 0): number {
  if (value === null || typeof value !== "object") return level;
  const children = Array.isArray(value) ? value : Object.values(value as object);
  return children.reduce<number>((max, child) => Math.max(max, depthOf(child, level + 1)), level + 1);
}

function toIssues(error: z.ZodError): Issue[] {
  // Jamais la valeur reçue : seulement le chemin et la règle violée.
  return error.issues.slice(0, 20).map((i) => ({ path: i.path.join(".") || "(racine)", message: i.message }));
}

/** Valide et normalise un corps déjà décodé. `now` est injectable pour les tests. */
export function parseMetricsPayload(body: unknown, now: Date = new Date()): ParseResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, code: "invalid_payload", issues: [{ path: "(racine)", message: "Objet JSON attendu" }] };
  }

  const isV1 = "contract_version" in (body as Record<string, unknown>);
  const parsed = isV1 ? metricsPayloadV1.safeParse(body) : metricsPayloadLegacy.safeParse(body);
  if (!parsed.success) return { ok: false, code: "invalid_payload", issues: toIssues(parsed.error) };

  const d = parsed.data as Record<string, unknown> & { details?: Record<string, unknown> };

  if (d.details) {
    if (Buffer.byteLength(JSON.stringify(d.details), "utf8") > MAX_DETAILS_BYTES) {
      return { ok: false, code: "invalid_details", issues: [{ path: "details", message: `Plus de ${MAX_DETAILS_BYTES} octets` }] };
    }
    if (depthOf(d.details) > MAX_DETAILS_DEPTH) {
      return { ok: false, code: "invalid_details", issues: [{ path: "details", message: `Profondeur maximale ${MAX_DETAILS_DEPTH}` }] };
    }
  }

  const sentAt = (isV1 ? d.collected_at : d.timestamp) as string | undefined;
  return {
    ok: true,
    data: {
      contractVersion: isV1 ? 1 : 0,
      projet: d.projet as NormalizedMetrics["projet"],
      nom: d.nom as string,
      environment: isV1 ? (d.environment as NormalizedMetrics["environment"]) : "production",
      collectedAt: sentAt ? new Date(sentAt) : now,
      collectedAtSource: sentAt ? "sender" : "received",
      runId: isV1 ? (d.run_id as string) : null,
      statut_sante: d.statut_sante as NormalizedMetrics["statut_sante"],
      mrr: d.mrr as number | undefined,
      comptes_actifs: d.comptes_actifs as number | undefined,
      details: d.details,
    },
  };
}

export type TimeCheck = { ok: true } | { ok: false; code: "future_payload" | "stale_payload"; message: string };

/** Refuse une collecte située dans le futur ou trop ancienne pour être « actuelle ». */
export function checkCollectionTime(collectedAt: Date, now: Date = new Date()): TimeCheck {
  const delta = collectedAt.getTime() - now.getTime();
  if (delta > MAX_FUTURE_SKEW_MS) {
    return { ok: false, code: "future_payload", message: "collected_at est dans le futur (horloge de l'émetteur ?)" };
  }
  if (-delta > MAX_AGE_MS) {
    return { ok: false, code: "stale_payload", message: "collected_at est trop ancien pour une donnée actuelle" };
  }
  return { ok: true };
}
