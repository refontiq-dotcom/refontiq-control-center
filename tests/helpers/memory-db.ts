import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type Op = { table: string; kind: "select" | "upsert" | "insert"; row?: Row };

const V1_ONLY: Record<string, string[]> = {
  portfolio_metrics: ["contract_version", "environment", "received_at", "last_run_id"],
  portfolio_metric_snapshots: ["contract_version", "environment", "received_at", "run_id"],
};
const DEFAULTS: Record<string, Row> = {
  portfolio_metrics: { mrr: 0, comptes_actifs: 0, statut_sante: "unknown", details: {} },
  portfolio_metric_snapshots: {},
};

/**
 * Faux Supabase EN MÉMOIRE, assez fidèle pour tester la logique de stockage :
 * upsert par `projet`, colonnes absentes conservées, index unique (projet, run_id),
 * mode « schéma ancien » (colonnes v1 inconnues) et injection de pannes.
 */
export function makeMemoryDb(options: {
  schema?: "v1" | "legacy";
  fail?: (op: Op) => DbError | null;
  metrics?: Row[];
  snapshots?: Row[];
} = {}) {
  const tables: Record<string, Row[]> = {
    portfolio_metrics: [...(options.metrics ?? [])],
    portfolio_metric_snapshots: [...(options.snapshots ?? [])],
  };
  const log: Op[] = [];
  const legacy = options.schema === "legacy";

  const unknownColumn = (table: string, keys: string[]): DbError | null => {
    if (!legacy) return null;
    const bad = keys.find((k) => V1_ONLY[table]?.includes(k));
    return bad ? { code: "PGRST204", message: `Could not find the '${bad}' column of '${table}' in the schema cache` } : null;
  };

  function from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let kind: Op["kind"] = "select";
    let row: Row | undefined;
    let conflict = "projet";
    let columns: string[] | null = null;
    let single = false;

    const run = (): { data: unknown; error: DbError | null } => {
      const op: Op = { table, kind, row };
      log.push(op);
      const injected = options.fail?.(op);
      if (injected) return { data: null, error: injected };

      const filterCols = filters.map(([c]) => c);
      const err = unknownColumn(table, [...filterCols, ...(row ? Object.keys(row) : [])]);
      if (err) return { data: null, error: err };

      const match = (r: Row) => filters.every(([c, v]) => r[c] === v);
      const project = (r: Row) =>
        columns ? Object.fromEntries(columns.map((c) => [c, r[c]])) : { ...r };

      if (kind === "select") {
        const rows = tables[table].filter(match).map(project);
        return { data: single ? (rows[0] ?? null) : rows, error: null };
      }
      if (kind === "insert") {
        const run_id = row?.run_id;
        if (run_id != null && tables[table].some((r) => r.projet === row?.projet && r.run_id === run_id)) {
          return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        tables[table].push({ ...DEFAULTS[table], ...row });
        return { data: null, error: null };
      }
      // upsert
      const existing = tables[table].find((r) => r[conflict] === row?.[conflict]);
      if (existing) Object.assign(existing, row);
      else tables[table].push({ ...DEFAULTS[table], ...row });
      const stored = existing ?? tables[table][tables[table].length - 1];
      return { data: single ? project(stored) : [project(stored)], error: null };
    };

    const b: Record<string, unknown> = {
      select: (cols?: string) => {
        if (cols && cols !== "*") columns = cols.split(",").map((c) => c.trim());
        return b;
      },
      eq: (c: string, v: unknown) => (filters.push([c, v]), b),
      limit: () => b,
      upsert: (r: Row, o?: { onConflict?: string }) => ((kind = "upsert"), (row = r), (conflict = o?.onConflict ?? "projet"), b),
      insert: (r: Row) => ((kind = "insert"), (row = r), b),
      maybeSingle: () => ((single = true), Promise.resolve(run())),
      single: () => ((single = true), Promise.resolve(run())),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }

  return { client: { from } as unknown as SupabaseClient, tables, log };
}
