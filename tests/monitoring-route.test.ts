import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => ({
  metrics: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  readFail: null as null | "metrics" | "alerts",
  insertFail: false,
  telegramConfigured: false,
  telegramOk: true,
  pushResult: { sent: 1 } as Record<string, unknown> | "throw",
  telegramMessages: [] as string[],
  pushes: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      let like: string | null = null;
      let gte: string | null = null;
      b.select = () => b;
      b.like = (_c: string, p: string) => ((like = p.replace("%", "")), b);
      b.gte = (_c: string, v: string) => ((gte = v), b);
      b.insert = (row: Record<string, unknown>) => {
        if (S.insertFail) return Promise.resolve({ error: { code: "23514" } });
        S.alerts.push({ ...row, created_at: new Date().toISOString() });
        return Promise.resolve({ error: null });
      };
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        if (table === "portfolio_metrics") return Promise.resolve(S.readFail === "metrics" ? { data: null, error: { code: "XX000" } } : { data: S.metrics, error: null }).then(res, rej);
        const rows = S.alerts.filter((a) => (!like || String(a.type).startsWith(like)) && (!gte || String(a.created_at) >= gte));
        return Promise.resolve(S.readFail === "alerts" ? { data: null, error: { code: "XX000" } } : { data: rows, error: null }).then(res, rej);
      };
      return b;
    },
  }),
}));
vi.mock("@/lib/telegram", () => ({
  escapeMarkdown: (t: string) => t.replace(/([_*[\]`\\])/g, "\\$1"),
  getTelegramAdminUrl: (f: string) => f,
  isTelegramConfigured: () => S.telegramConfigured,
  sendTelegramMessage: async (text: string) => { S.telegramMessages.push(text); return S.telegramOk; },
}));
vi.mock("@/lib/web-push", () => ({
  sendWebPushToAll: async (p: Record<string, unknown>) => {
    S.pushes.push(p);
    if (S.pushResult === "throw") throw new Error("push down");
    return S.pushResult;
  },
}));

import { GET, POST } from "@/app/api/monitoring/check/route";

const SECRET = "monitoring-secret-de-test";
const H = 3600_000;
const metric = (projet: string, ageMs: number) => ({ projet, nom: projet, statut_sante: "healthy", derniere_synchro: new Date(Date.now() - ageMs).toISOString() });
const call = (headers: Record<string, string> = {}, fn = POST) => fn(new Request("http://x/api/monitoring/check", { method: "POST", headers }));
const authed = () => call({ authorization: `Bearer ${SECRET}` });
interface ApiBody {
  ok?: boolean; code?: string; stage?: string; notified?: number; skipped_duplicates?: number;
  findings: Array<{ projet: string; kind: string; severity: string; message: string }>;
  channels: { telegram_configured: boolean };
  delivery: Array<{ type: string; telegram: string; web_push: string; recorded: boolean }>;
}
const body = async (r: Response) => (await r.json()) as ApiBody;

describe("POST /api/monitoring/check", () => {
  beforeEach(() => {
    process.env.MONITORING_SECRET = SECRET;
    Object.assign(S, { metrics: [metric("sejoura", 2 * H), metric("schooly", 2 * H)], alerts: [], readFail: null, insertFail: false, telegramConfigured: false, telegramOk: true, pushResult: { sent: 1 }, telegramMessages: [], pushes: [] });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe("authentification", () => {
    it("503 explicite si MONITORING_SECRET n'est pas défini (pas de silence)", async () => {
      delete process.env.MONITORING_SECRET;
      const r = await authed();
      expect(r.status).toBe(503);
      expect(await body(r)).toMatchObject({ code: "monitoring_not_configured" });
    });
    it("401 sans en-tête, avec un mauvais secret, ou avec le secret des métriques", async () => {
      process.env.METRICS_PUSH_SECRET = "autre-secret";
      expect((await call()).status).toBe(401);
      expect((await call({ authorization: "Bearer faux" })).status).toBe(401);
      expect((await call({ authorization: "Bearer autre-secret" })).status).toBe(401); // un secret par usage
      expect((await call({ authorization: SECRET })).status).toBe(401);
    });
    it("rien n'est lu ni écrit tant que l'appelant n'est pas authentifié", async () => {
      S.metrics = [metric("sejoura", 500 * H)];
      await call({ authorization: "Bearer faux" });
      expect(S.alerts).toHaveLength(0);
    });
    it("GET accepté avec le bon secret (test manuel depuis un navigateur ou curl)", async () => {
      expect((await call({ authorization: `Bearer ${SECRET}` }, GET)).status).toBe(200);
    });
  });

  describe("situation saine", () => {
    it("200, aucun constat, aucune alerte, aucun envoi", async () => {
      const r = await authed();
      expect(r.status).toBe(200);
      expect(await body(r)).toMatchObject({ ok: true, findings: [], notified: 0 });
      expect(S.alerts).toHaveLength(0);
      expect(S.pushes).toHaveLength(0);
    });
  });

  describe("un produit se tait", () => {
    beforeEach(() => { S.metrics = [metric("sejoura", 60 * H), metric("schooly", 2 * H)]; });

    it("alerte enregistrée ET notification poussée, avec un message utile", async () => {
      const b = await body(await authed());
      expect(b).toMatchObject({ ok: true, notified: 1 });
      expect(b.findings[0]).toMatchObject({ projet: "sejoura", kind: "stale", severity: "warning" });
      expect(S.alerts).toHaveLength(1);
      expect(S.alerts[0]).toMatchObject({ type: "monitor:sejoura:stale:warning", level: "warning", status: "sent" });
      expect(S.pushes[0]).toMatchObject({ level: "warning", href: "/admin/supervision" });
    });

    it("le niveau enregistré respecte la contrainte de la table (info, warning, critical, success)", async () => {
      S.metrics = [metric("sejoura", 500 * H), metric("schooly", 2 * H)];
      await authed();
      expect(["info", "warning", "critical", "success"]).toContain(S.alerts[0].level);
      expect(S.alerts[0].level).toBe("critical");
    });

    it("deuxième passage : pas de doublon (anti-spam)", async () => {
      await authed();
      const b = await body(await authed());
      expect(b).toMatchObject({ notified: 0, skipped_duplicates: 1 });
      expect(S.alerts).toHaveLength(1);
      expect(S.pushes).toHaveLength(1);
    });

    it("retour à la normale : annoncé une fois", async () => {
      await authed();
      S.metrics = [metric("sejoura", 1 * H), metric("schooly", 2 * H)];
      const b = await body(await authed());
      expect(b.notified).toBe(1);
      expect(S.alerts.at(-1)).toMatchObject({ type: "monitor:sejoura:recovered", level: "success" });
      expect((await body(await authed())).notified).toBe(0);
    });
  });

  describe("canaux de livraison", () => {
    beforeEach(() => { S.metrics = [metric("sejoura", 60 * H), metric("schooly", 2 * H)]; });

    it("Telegram configuré : message envoyé avec le titre échappé", async () => {
      S.telegramConfigured = true;
      const b = await body(await authed());
      expect(b.channels.telegram_configured).toBe(true);
      expect(b.delivery[0].telegram).toBe("sent");
      expect(S.telegramMessages[0]).toContain("sejoura");
    });

    it("aucun canal configuré : l'alerte est quand même ENREGISTRÉE (visible dans l'application), statut « recorded »", async () => {
      S.pushResult = { sent: 0, skipped: true };
      await authed();
      expect(S.alerts[0].status).toBe("recorded");
    });

    it("tous les canaux en échec : statut « failed » → retentée au passage suivant, sans doublon d'alerte livrée", async () => {
      S.telegramConfigured = true; S.telegramOk = false; S.pushResult = "throw";
      await authed();
      expect(S.alerts[0].status).toBe("failed");
      S.telegramOk = true;
      const b = await body(await authed());
      expect(b.notified).toBe(1);
      expect(S.alerts).toHaveLength(2);
      expect(S.alerts[1].status).toBe("sent");
    });

    it("Telegram en échec mais notification push réussie : considérée livrée", async () => {
      S.telegramConfigured = true; S.telegramOk = false;
      await authed();
      expect(S.alerts[0].status).toBe("sent");
    });
  });

  describe("pannes de la source", () => {
    it("lecture des métriques impossible → 500 explicite, aucune fausse alerte « tout va bien »", async () => {
      S.readFail = "metrics";
      const r = await authed();
      expect(r.status).toBe(500);
      expect(await body(r)).toMatchObject({ ok: false, stage: "read_metrics", code: "source_unavailable" });
      expect(S.alerts).toHaveLength(0);
    });
    it("lecture de l'historique impossible → 500 (pas de risque d'inonder de doublons)", async () => {
      S.readFail = "alerts";
      const r = await authed();
      expect(r.status).toBe(500);
      expect((await body(r)).stage).toBe("read_history");
    });
    it("enregistrement impossible : signalé dans la réponse, sans plantage", async () => {
      S.metrics = [metric("sejoura", 60 * H), metric("schooly", 2 * H)];
      S.insertFail = true;
      const b = await body(await authed());
      expect(b.delivery[0].recorded).toBe(false);
    });
    it("les réponses ne contiennent jamais le secret", async () => {
      S.metrics = [metric("sejoura", 60 * H), metric("schooly", 2 * H)];
      const text = JSON.stringify(await body(await authed()));
      expect(text).not.toContain(SECRET);
    });
  });

  it("produit absent de la base : constat critique « aucune donnée reçue »", async () => {
    S.metrics = [metric("schooly", 2 * H)];
    const b = await body(await authed());
    expect(b.findings[0]).toMatchObject({ projet: "sejoura", kind: "missing", severity: "critical" });
  });
});
