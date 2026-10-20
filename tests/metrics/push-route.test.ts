import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMemoryDb } from "../helpers/memory-db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (state.db as { client: unknown }).client }));

import { POST } from "@/app/api/metrics/push/route";

const SECRET = "test-secret-not-a-real-one";
const RUN_A = "5a0f2c1e-8c53-4b3a-9d55-0d6f4f1b2a10";
const RUN_B = "6b1f3d2f-9d64-4c4b-8e66-1e7f5f2c3b21";

// Horloge de référence FIGÉE pour tout le fichier : deux appels de v1() produisent le
// même envoi (même collected_at), comme le ferait une relance de l'émetteur.
const T0 = Date.now();
const iso = (offsetMs = 0) => new Date(T0 + offsetMs).toISOString();
const v1 = (over: Record<string, unknown> = {}) => ({
  contract_version: 1, projet: "sejoura", nom: "Séjoura", environment: "production",
  collected_at: iso(-60_000), run_id: RUN_A, mrr: 125000, comptes_actifs: 17,
  statut_sante: "healthy", details: { reservations_actives: 10 }, ...over,
});

function post(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }, raw?: string) {
  return POST(new Request("http://localhost/api/metrics/push", {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body: raw ?? JSON.stringify(body),
  }));
}
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("POST /api/metrics/push", () => {
  beforeEach(() => {
    process.env.METRICS_PUSH_SECRET = SECRET;
    state.db = makeMemoryDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  const db = () => state.db as ReturnType<typeof makeMemoryDb>;

  describe("authentification", () => {
    it("401 sans en-tête, avec un mauvais secret, ou avec un autre schéma", async () => {
      for (const h of [{}, { authorization: "Bearer mauvais" }, { authorization: `Basic ${SECRET}` }, { authorization: SECRET }]) {
        const res = await post(v1(), h as Record<string, string>);
        expect(res.status).toBe(401);
        expect((await json(res)).code).toBe("unauthorized");
      }
      expect(db().log).toEqual([]); // rien n'a été lu ni écrit
    });
    it("503 (et non 401) si le récepteur n'a pas de secret configuré", async () => {
      delete process.env.METRICS_PUSH_SECRET;
      const res = await post(v1());
      expect(res.status).toBe(503);
      expect((await json(res)).code).toBe("receiver_not_configured");
    });
    it("lit le secret à chaque requête (rotation sans redémarrage)", async () => {
      process.env.METRICS_PUSH_SECRET = "nouveau-secret";
      expect((await post(v1())).status).toBe(401);
      expect((await post(v1(), { authorization: "Bearer nouveau-secret" })).status).toBe(200);
    });
  });

  describe("validation", () => {
    it("400 invalid_json, sans rien écrire", async () => {
      const res = await post(null, undefined, "{pas du json");
      expect(res.status).toBe(400);
      expect((await json(res)).code).toBe("invalid_json");
      expect(db().log).toEqual([]);
    });
    it("400 invalid_payload avec la liste des champs fautifs (jamais leurs valeurs)", async () => {
      const res = await post(v1({ mrr: "VALEUR-SECRETE" }));
      const body = await json(res);
      expect(res.status).toBe(400);
      expect(body.code).toBe("invalid_payload");
      expect(JSON.stringify(body)).toContain("mrr");
      expect(JSON.stringify(body)).not.toContain("VALEUR-SECRETE");
      expect(db().log).toEqual([]);
    });
    it("413 au-delà de 64 Ko", async () => {
      const res = await post(v1({ details: { x: "y".repeat(70_000) } }));
      expect(res.status).toBe(413);
    });
    it("422 pour un aperçu : il ne doit jamais écraser la production", async () => {
      const res = await post(v1({ environment: "preview" }));
      expect(res.status).toBe(422);
      expect((await json(res)).code).toBe("environment_not_accepted");
      expect(db().log).toEqual([]);
    });
    it("422 pour une collecte dans le futur et pour une donnée trop ancienne", async () => {
      expect((await json(await post(v1({ collected_at: iso(3600_000) })))).code).toBe("future_payload");
      expect((await json(await post(v1({ collected_at: iso(-80 * 3600_000) })))).code).toBe("stale_payload");
      expect(db().log).toEqual([]);
    });
  });

  describe("stockage et cohérence", () => {
    it("enregistre la valeur courante ET l'historique, avec la date de COLLECTE", async () => {
      const collected = iso(-120_000);
      const res = await post(v1({ collected_at: collected }));
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ ok: true, status: "stored", schema: "v1", collected_at_source: "sender" });
      expect(body.collected_at).toBe(collected);

      const [cur] = db().tables.portfolio_metrics;
      expect(cur).toMatchObject({ projet: "sejoura", mrr: 125000, comptes_actifs: 17, statut_sante: "healthy", derniere_synchro: collected, last_run_id: RUN_A });
      expect(cur.received_at).not.toBe(collected); // réception ≠ collecte
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
      expect(db().tables.portfolio_metric_snapshots[0]).toMatchObject({ mrr: 125000, captured_at: collected, run_id: RUN_A });
    });

    it("renvoyer le MÊME envoi est sans effet (idempotence par run_id)", async () => {
      const payload = v1();
      expect((await json(await post(payload))).status).toBe("stored");
      expect((await json(await post(payload))).status).toBe("duplicate");
      expect((await json(await post(payload))).status).toBe("duplicate");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
    });

    it("deux collectes distinctes produisent deux points d'historique", async () => {
      await post(v1({ run_id: RUN_A, collected_at: iso(-200_000), mrr: 100000 }));
      await post(v1({ run_id: RUN_B, collected_at: iso(-100_000), mrr: 125000 }));
      expect(db().tables.portfolio_metric_snapshots.map((s) => s.mrr)).toEqual([100000, 125000]);
      expect(db().tables.portfolio_metrics[0].mrr).toBe(125000);
    });

    it("un envoi PLUS ANCIEN que l'état courant n'écrase pas celui-ci (historique seul)", async () => {
      await post(v1({ run_id: RUN_B, collected_at: iso(-60_000), mrr: 125000 }));
      const res = await post(v1({ run_id: RUN_A, collected_at: iso(-3600_000), mrr: 1 }));
      const body = await json(res);
      expect(body.status).toBe("history_only");
      expect(String(body.warnings)).toContain("older_than_current");
      expect(db().tables.portfolio_metrics[0].mrr).toBe(125000);
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(2);
    });

    it("un champ ABSENT est conservé, jamais remplacé par 0", async () => {
      await post(v1({ run_id: RUN_A, collected_at: iso(-200_000), mrr: 125000, comptes_actifs: 17 }));
      await post(v1({ run_id: RUN_B, collected_at: iso(-100_000), mrr: undefined, comptes_actifs: undefined, statut_sante: undefined }));
      expect(db().tables.portfolio_metrics[0]).toMatchObject({ mrr: 125000, comptes_actifs: 17, statut_sante: "healthy" });
      expect(db().tables.portfolio_metric_snapshots[1]).toMatchObject({ mrr: 125000, comptes_actifs: 17 });
    });

    it("un premier envoi sans mrr ne fabrique pas de MRR autre que la valeur par défaut explicite", async () => {
      await post(v1({ mrr: undefined }));
      expect(db().tables.portfolio_metrics[0].mrr).toBe(0); // défaut de colonne, pas une valeur envoyée
    });
  });

  describe("compatibilité avec les anciens émetteurs", () => {
    const legacy = { projet: "schooly", nom: "Schooly", mrr: 5000, comptes_actifs: 3, statut_sante: "healthy", timestamp: iso(-300_000) };

    it("accepte l'ancien format, daté par `timestamp`, et le signale", async () => {
      const res = await post(legacy);
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ status: "stored", contract_version: 0, collected_at_source: "sender", success: true });
      expect(db().tables.portfolio_metrics[0].derniere_synchro).toBe(legacy.timestamp);
    });

    it("renvoyer le même ancien envoi est aussi sans effet (doublon sur la date de collecte)", async () => {
      await post(legacy);
      expect((await json(await post(legacy))).status).toBe("duplicate");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
    });
  });

  describe("pannes de stockage : jamais de faux succès", () => {
    it("history_failed : l'état courant est enregistré, l'erreur est explicite, la relance répare", async () => {
      let failSnapshots = true;
      state.db = makeMemoryDb({
        fail: (op) => (failSnapshots && op.table === "portfolio_metric_snapshots" && op.kind === "insert"
          ? { code: "XX000", message: "boom" } : null),
      });
      const res = await post(v1());
      const body = await json(res);
      expect(res.status).toBe(500);
      expect(body).toMatchObject({ code: "history_failed", metric_stored: true, retryable: true });
      expect(db().tables.portfolio_metrics).toHaveLength(1);
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(0);

      failSnapshots = false; // l'historique redevient disponible : on renvoie le MÊME envoi
      expect((await json(await post(v1()))).status).toBe("stored");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
      expect(db().tables.portfolio_metrics).toHaveLength(1); // pas de double ligne
    });

    it("storage_failed si l'état courant est illisible : rien n'est écrit", async () => {
      state.db = makeMemoryDb({ fail: (op) => (op.table === "portfolio_metrics" && op.kind === "select" ? { code: "XX000", message: "boom" } : null) });
      const res = await post(v1());
      expect(res.status).toBe(500);
      expect((await json(res)).code).toBe("storage_failed");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(0);
    });

    it("course entre deux envois identiques (violation d'unicité) → doublon, pas une erreur", async () => {
      state.db = makeMemoryDb({
        snapshots: [], // la recherche de doublon ne trouve rien…
        fail: (op) => (op.table === "portfolio_metric_snapshots" && op.kind === "insert"
          ? { code: "23505", message: "duplicate key" } : null), // …mais l'insertion perd la course
      });
      const res = await post(v1());
      expect(res.status).toBe(200);
      expect((await json(res)).status).toBe("duplicate");
    });

    it("ne journalise ni le secret ni les valeurs métier", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      state.db = makeMemoryDb({ fail: (op) => (op.kind === "upsert" ? { code: "XX000", message: "boom" } : null) });
      await post(v1({ mrr: 987654 }));
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toContain("987654");
    });
  });

  describe("migration du contrat v1 pas encore appliquée (schéma ancien)", () => {
    beforeEach(() => { state.db = makeMemoryDb({ schema: "legacy" }); });

    it("fonctionne, enregistre les données, et LE SIGNALE (schema_outdated)", async () => {
      const res = await post(v1());
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.schema).toBe("legacy");
      expect(String(body.warnings)).toContain("schema_outdated");
      expect(db().tables.portfolio_metrics[0]).toMatchObject({ mrr: 125000 });
      expect(db().tables.portfolio_metrics[0]).not.toHaveProperty("last_run_id");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
    });

    it("l'idempotence reste assurée (par date de collecte)", async () => {
      await post(v1());
      expect((await json(await post(v1()))).status).toBe("duplicate");
      expect(db().tables.portfolio_metric_snapshots).toHaveLength(1);
    });
  });
});
