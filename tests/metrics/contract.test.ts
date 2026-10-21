import { describe, expect, it } from "vitest";
import { MAX_AGE_MS, checkCollectionTime, parseMetricsPayload } from "@/lib/contracts/metrics-v1";
import { bearerToken, safeEqual } from "@/lib/security/safe-equal";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const RUN = "5a0f2c1e-8c53-4b3a-9d55-0d6f4f1b2a10";
const v1 = (over: Record<string, unknown> = {}) => ({
  contract_version: 1,
  projet: "sejoura",
  nom: "Séjoura",
  environment: "production",
  collected_at: "2026-10-19T11:59:00.000Z",
  run_id: RUN,
  mrr: 125000,
  comptes_actifs: 17,
  statut_sante: "healthy",
  details: { reservations_actives: 10 },
  ...over,
});

describe("contrat v1 — validation", () => {
  it("accepte un envoi complet et le normalise", () => {
    const r = parseMetricsPayload(v1(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({ contractVersion: 1, projet: "sejoura", mrr: 125000, runId: RUN, collectedAtSource: "sender" });
      expect(r.data.collectedAt.toISOString()).toBe("2026-10-19T11:59:00.000Z");
    }
  });

  it.each([
    ["projet inconnu", { projet: "inconnu" }],
    ["MRR décimal", { mrr: 100.5 }],
    ["MRR négatif", { mrr: -1 }],
    ["MRR en chaîne (v1 est strict)", { mrr: "100" }],
    ["MRR booléen", { mrr: true }],
    ["comptes_actifs trop grand", { comptes_actifs: 3_000_000_000 }],
    ["statut inconnu", { statut_sante: "excellent" }],
    ["run_id non UUID", { run_id: "abc" }],
    ["collected_at illisible", { collected_at: "hier" }],
    ["collected_at sans fuseau", { collected_at: "2026-10-19T11:59:00" }],
    ["environnement inconnu", { environment: "staging" }],
    ["details en tableau", { details: [1, 2] }],
    ["nom vide", { nom: "   " }],
  ])("refuse : %s", (_label, over) => {
    const r = parseMetricsPayload(v1(over), NOW);
    expect(r.ok).toBe(false);
  });

  it("ne renvoie jamais la valeur reçue dans les erreurs", () => {
    const r = parseMetricsPayload(v1({ mrr: "VALEUR-SECRETE-123" }), NOW);
    expect(JSON.stringify(r)).not.toContain("VALEUR-SECRETE-123");
  });

  it("refuse un `details` trop profond ou trop volumineux", () => {
    const deep = { a: { b: { c: { d: 1 } } } };
    expect(parseMetricsPayload(v1({ details: deep }), NOW)).toMatchObject({ ok: false, code: "invalid_details" });
    const big = { texte: "x".repeat(400), ...Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`k${i}`, "y".repeat(400)])) };
    expect(parseMetricsPayload(v1({ details: big }), NOW)).toMatchObject({ ok: false });
  });

  it("refuse un corps qui n'est pas un objet", () => {
    for (const body of [null, [], "x", 3]) expect(parseMetricsPayload(body, NOW).ok).toBe(false);
  });
});

describe("ancien format (sans contract_version)", () => {
  const legacy = { projet: "schooly", nom: "Schooly", mrr: 5000, comptes_actifs: 3, statut_sante: "healthy", timestamp: "2026-10-19T10:00:00.000Z" };

  it("reste accepté ; `timestamp` devient la date de collecte", () => {
    const r = parseMetricsPayload(legacy, NOW);
    expect(r.ok && r.data.contractVersion).toBe(0);
    expect(r.ok && r.data.collectedAt.toISOString()).toBe("2026-10-19T10:00:00.000Z");
    expect(r.ok && r.data.collectedAtSource).toBe("sender");
  });

  it("sans date, la collecte est datée à la réception et signalée comme telle", () => {
    const { timestamp: _t, ...rest } = legacy;
    void _t;
    const r = parseMetricsPayload(rest, NOW);
    expect(r.ok && r.data.collectedAtSource).toBe("received");
    expect(r.ok && r.data.collectedAt.getTime()).toBe(NOW.getTime());
  });

  it("n'invente aucune valeur : un champ absent reste `undefined` (pas 0)", () => {
    const r = parseMetricsPayload({ projet: "docly", nom: "Docly" }, NOW);
    expect(r.ok && r.data.mrr).toBeUndefined();
    expect(r.ok && r.data.comptes_actifs).toBeUndefined();
    expect(r.ok && r.data.statut_sante).toBeUndefined();
  });

  it("tolère des entiers en chaîne, mais refuse '', true et '1e3'", () => {
    expect(parseMetricsPayload({ ...legacy, mrr: "5000" }, NOW).ok).toBe(true);
    for (const bad of ["", true, "1e3", "12.5", "-4"]) {
      expect(parseMetricsPayload({ ...legacy, mrr: bad }, NOW).ok).toBe(false);
    }
  });
});

describe("fraîcheur de la date de collecte", () => {
  it("accepte le présent et une petite dérive d'horloge", () => {
    expect(checkCollectionTime(new Date(NOW.getTime() + 60_000), NOW).ok).toBe(true);
    expect(checkCollectionTime(new Date(NOW.getTime() - 3600_000), NOW).ok).toBe(true);
  });
  it("refuse le futur lointain", () => {
    expect(checkCollectionTime(new Date(NOW.getTime() + 10 * 60_000), NOW)).toMatchObject({ ok: false, code: "future_payload" });
  });
  it("refuse une donnée trop ancienne pour être actuelle", () => {
    expect(checkCollectionTime(new Date(NOW.getTime() - MAX_AGE_MS - 1000), NOW)).toMatchObject({ ok: false, code: "stale_payload" });
  });
});

describe("comparaison de secrets", () => {
  it("égalité exacte uniquement, quelles que soient les longueurs", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secret ")).toBe(false);
    expect(safeEqual("secret", "")).toBe(false);
    expect(safeEqual("a".repeat(5000), "a")).toBe(false);
  });
  it("extrait le jeton Bearer", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
    expect(bearerToken("bearer   abc ")).toBe("abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
