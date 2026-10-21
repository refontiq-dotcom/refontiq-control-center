import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedMetrics } from "@/lib/contracts/metrics-v1";

// ============================================================================
// Stockage d'un envoi de métriques conforme au contrat v1.
//
// Ordre d'écriture (choix délibéré) :
//   1. état courant (portfolio_metrics, upsert idempotent)
//   2. historique (portfolio_metric_snapshots)
// Le doublon est détecté sur l'HISTORIQUE, écrit en dernier : si l'étape 2 échoue,
// une nouvelle tentative du même envoi refait l'étape 1 (sans effet) puis écrit
// l'historique. Un envoi n'est jamais « perdu » ni compté deux fois.
//
// Un champ ABSENT de l'envoi n'est pas écrit : la valeur précédente est conservée
// (jamais remplacée par un faux zéro).
// ============================================================================

type DbError = { code?: string | null; message?: string | null } | null;

export type StoreOutcome =
  | { ok: true; status: "stored" | "history_only" | "duplicate"; schema: "v1" | "legacy"; warnings: string[] }
  | { ok: false; code: "storage_failed" | "history_failed"; metricStored: boolean };

/** Colonne inexistante : migration du contrat v1 pas encore appliquée. */
export function isMissingColumn(error: DbError): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist|could not find the .* column/i.test(msg)
  );
}

const isUniqueViolation = (e: DbError) => e?.code === "23505";

type CurrentRow = {
  derniere_synchro: string | null;
  mrr: number | null;
  comptes_actifs: number | null;
  statut_sante: string | null;
} | null;

export async function storeMetrics(
  admin: SupabaseClient,
  m: NormalizedMetrics,
  receivedAt: Date
): Promise<StoreOutcome> {
  const warnings: string[] = [];
  let schema: "v1" | "legacy" = "v1";
  const capturedAt = m.collectedAt.toISOString();

  const v1Columns = {
    contract_version: m.contractVersion,
    environment: m.environment,
    received_at: receivedAt.toISOString(),
  };

  // 1) Doublon : cet envoi a-t-il déjà été entièrement enregistré ?
  const dupQuery = async (byRunId: boolean) => {
    let q = admin.from("portfolio_metric_snapshots").select("id").eq("projet", m.projet);
    q = byRunId ? q.eq("run_id", m.runId as string) : q.eq("captured_at", capturedAt);
    return q.limit(1).maybeSingle();
  };
  let dup = await dupQuery(Boolean(m.runId));
  if (dup.error && isMissingColumn(dup.error)) {
    schema = "legacy";
    dup = await dupQuery(false);
  }
  if (dup.error) return { ok: false, code: "storage_failed", metricStored: false };
  if (dup.data) return { ok: true, status: "duplicate", schema, warnings };

  // 2) État courant : cet envoi est-il plus récent que ce qui est stocké ?
  const { data: current, error: currentError } = (await admin
    .from("portfolio_metrics")
    .select("derniere_synchro, mrr, comptes_actifs, statut_sante")
    .eq("projet", m.projet)
    .maybeSingle()) as { data: CurrentRow; error: DbError };
  if (currentError) return { ok: false, code: "storage_failed", metricStored: false };

  const isNewest =
    !current?.derniere_synchro || m.collectedAt.getTime() >= new Date(current.derniere_synchro).getTime();

  // Valeurs de référence pour l'historique (jamais de faux zéro pour un champ absent).
  let state = {
    mrr: m.mrr ?? current?.mrr ?? 0,
    comptes_actifs: m.comptes_actifs ?? current?.comptes_actifs ?? 0,
    statut_sante: m.statut_sante ?? current?.statut_sante ?? "unknown",
  };

  if (isNewest) {
    const base: Record<string, unknown> = {
      projet: m.projet,
      nom: m.nom,
      // Date de COLLECTE : c'est elle qui détermine la fraîcheur affichée.
      derniere_synchro: capturedAt,
      ...(m.mrr !== undefined && { mrr: m.mrr }),
      ...(m.comptes_actifs !== undefined && { comptes_actifs: m.comptes_actifs }),
      ...(m.statut_sante !== undefined && { statut_sante: m.statut_sante }),
      ...(m.details !== undefined && { details: m.details }),
    };
    const upsert = (row: Record<string, unknown>) =>
      admin
        .from("portfolio_metrics")
        .upsert(row, { onConflict: "projet" })
        .select("mrr, comptes_actifs, statut_sante")
        .single();

    let res = await upsert(schema === "v1" ? { ...base, ...v1Columns, last_run_id: m.runId } : base);
    if (res.error && isMissingColumn(res.error)) {
      schema = "legacy";
      res = await upsert(base);
    }
    if (res.error || !res.data) return { ok: false, code: "storage_failed", metricStored: false };
    state = res.data as typeof state;
  } else {
    warnings.push("older_than_current: état courant conservé, historique seul enregistré");
  }

  // 3) Historique.
  const snapshotBase: Record<string, unknown> = {
    projet: m.projet,
    nom: m.nom,
    ...state,
    details: m.details ?? {},
    captured_at: capturedAt,
  };
  const insert = (row: Record<string, unknown>) => admin.from("portfolio_metric_snapshots").insert(row);

  let snap = await insert(schema === "v1" ? { ...snapshotBase, ...v1Columns, run_id: m.runId } : snapshotBase);
  if (snap.error && isMissingColumn(snap.error)) {
    schema = "legacy";
    snap = await insert(snapshotBase);
  }
  if (snap.error) {
    // Course entre deux envois identiques : l'autre a gagné, ce n'est pas une erreur.
    if (isUniqueViolation(snap.error)) return { ok: true, status: "duplicate", schema, warnings };
    return { ok: false, code: "history_failed", metricStored: isNewest };
  }

  if (schema === "legacy") {
    warnings.push("schema_outdated: migration du contrat v1 non appliquée, provenance et run_id non conservés");
  }
  return { ok: true, status: isNewest ? "stored" : "history_only", schema, warnings };
}
