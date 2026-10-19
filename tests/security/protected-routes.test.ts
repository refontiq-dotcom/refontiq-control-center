import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAdminClient, makeAuthClient } from "../helpers/fake-supabase";

const state = vi.hoisted(() => ({ auth: null as unknown, admin: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => state.admin }));

import { POST as demoAlert } from "@/app/api/demo-alert/route";
import { GET as listAlerts } from "@/app/api/telegram-alerts/route";
import { POST as resync } from "@/app/api/resync-metrics/route";
import { GET as listMetrics } from "@/app/api/metrics/route";
import { POST as pushSubscribe } from "@/app/api/push/subscribe/route";

const ADMIN = { id: "u1", role: "super_admin", is_active: true };
const USER = { id: "auth-1" };
const validSub = { subscription: { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } } };
const subRequest = () =>
  new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validSub),
  });

type Case = {
  name: string;
  call: () => Promise<Response>;
  /** Table métier qui ne doit JAMAIS être touchée par un appelant refusé. */
  businessTable: string;
  okStatus: number;
};

const cases: Case[] = [
  { name: "POST /api/demo-alert", call: () => demoAlert(), businessTable: "telegram_alerts", okStatus: 200 },
  { name: "GET /api/telegram-alerts", call: () => listAlerts(), businessTable: "telegram_alerts", okStatus: 200 },
  { name: "POST /api/resync-metrics", call: () => resync(), businessTable: "portfolio_metrics", okStatus: 501 },
  { name: "GET /api/metrics", call: () => listMetrics(), businessTable: "portfolio_metrics", okStatus: 200 },
  { name: "POST /api/push/subscribe", call: () => pushSubscribe(subRequest()), businessTable: "push_subscriptions", okStatus: 200 },
];

describe.each(cases)("$name", ({ call, businessTable, okStatus }) => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  function setup(user: { id: string } | null, profile: Parameters<typeof makeAdminClient>[0]["profile"]) {
    state.auth = makeAuthClient(user);
    const admin = makeAdminClient({ profile });
    state.admin = admin.client;
    return admin;
  }

  it("refuse (401) un visiteur non authentifié, sans toucher aux données", async () => {
    const admin = setup(null, ADMIN);
    const res = await call();
    expect(res.status).toBe(401);
    expect(admin.touched).not.toContain(businessTable);
  });

  it("refuse (403) un utilisateur connecté qui n'est pas Super Admin", async () => {
    const admin = setup(USER, { ...ADMIN, role: "client" });
    const res = await call();
    expect(res.status).toBe(403);
    expect(admin.touched).not.toContain(businessTable);
  });

  it("refuse (403) un Super Admin désactivé", async () => {
    const admin = setup(USER, { ...ADMIN, is_active: false });
    const res = await call();
    expect(res.status).toBe(403);
    expect(admin.touched).not.toContain(businessTable);
  });

  it(`répond ${okStatus} à un Super Admin actif`, async () => {
    setup(USER, ADMIN);
    const res = await call();
    expect(res.status).toBe(okStatus);
  });
});

describe("garanties propres à chaque route", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("resync-metrics ne prétend plus avoir mis une synchro en file", async () => {
    state.auth = makeAuthClient(USER);
    state.admin = makeAdminClient({ profile: ADMIN }).client;
    const body = await (await resync()).json();
    expect(body.success).toBe(false);
    expect(body.status).toBe("not_implemented");
    expect(body).not.toHaveProperty("ref");
  });

  it("telegram-alerts ne renvoie que des colonnes explicites (pas de select *)", async () => {
    const calls: string[] = [];
    state.auth = makeAuthClient(USER);
    const admin = makeAdminClient({ profile: ADMIN });
    const baseFrom = admin.client.from;
    state.admin = {
      from: (t: string) => {
        const c = baseFrom(t) as Record<string, unknown>;
        if (t === "telegram_alerts") {
          const sel = c.select as (...a: unknown[]) => unknown;
          c.select = (...a: unknown[]) => (calls.push(String(a[0])), sel(...a));
        }
        return c;
      },
    };
    await listAlerts();
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBe("*");
  });

  it("push/subscribe valide l'abonnement, y compris pour un Super Admin (400)", async () => {
    state.auth = makeAuthClient(USER);
    state.admin = makeAdminClient({ profile: ADMIN }).client;
    const bad = new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: "x" } }),
    });
    expect((await pushSubscribe(bad)).status).toBe(400);
  });

  it("push/subscribe répond 400 (et non 500) à un corps JSON illisible", async () => {
    state.auth = makeAuthClient(USER);
    state.admin = makeAdminClient({ profile: ADMIN }).client;
    const broken = new Request("http://localhost/api/push/subscribe", { method: "POST", body: "pas du json" });
    expect((await pushSubscribe(broken)).status).toBe(400);
  });
});
