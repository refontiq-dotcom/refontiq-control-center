import { vi } from "vitest";

/** Résultat d'une requête Supabase simulée. */
export type Result = { data: unknown; error: { message: string } | null };

/**
 * Faux client « admin » : enregistre les tables lues/écrites, afin de PROUVER
 * qu'une requête refusée n'a touché à aucune donnée métier.
 */
export function makeAdminClient(opts: {
  profile?: { id: string; role: string; is_active: boolean | null } | null;
  profileError?: string;
  tables?: Record<string, Result>;
}) {
  const touched: string[] = [];
  const from = (table: string) => {
    touched.push(table);
    const result: Result =
      table === "users"
        ? { data: opts.profile ?? null, error: opts.profileError ? { message: opts.profileError } : null }
        : (opts.tables?.[table] ?? { data: [], error: null });
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "insert", "upsert", "update", "delete", "in"]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(() => Promise.resolve(result));
    chain.single = vi.fn(() => Promise.resolve(result));
    chain.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej);
    return chain;
  };
  return { client: { from }, touched };
}

/** Faux client d'authentification : volontairement SANS getSession. */
export function makeAuthClient(user: { id: string } | null) {
  return { auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) } };
}
