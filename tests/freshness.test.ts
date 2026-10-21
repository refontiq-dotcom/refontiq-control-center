import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERVAL_MINUTES,
  EXPECTED_INTERVAL_MINUTES,
  dataConfidence,
  expectedIntervalMinutes,
  formatDuration,
  isStale,
  staleAfterMinutes,
  syncAgeMinutes,
} from "@/lib/freshness";
import { buildDeterministicIntelligence } from "@/lib/intelligence";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const H = 60;

describe("fraîcheur par cadence d'envoi", () => {
  it("donnée absente ou invalide → « missing », jamais « fresh »", () => {
    for (const bad of [null, undefined, "", "pas une date"]) {
      expect(dataConfidence(bad, "sejoura", NOW)).toBe("missing");
      expect(isStale(bad, "sejoura", NOW)).toBe(true);
    }
  });

  it("produit quotidien : 25 h reste frais, 47 h aussi, 49 h est périmé (régression : l'ancien seuil de 30 min)", () => {
    expect(dataConfidence(ago(31), "schooly", NOW)).toBe("fresh"); // périmé avant, à tort
    expect(dataConfidence(ago(25 * H), "schooly", NOW)).toBe("fresh");
    expect(dataConfidence(ago(47 * H), "schooly", NOW)).toBe("fresh");
    expect(dataConfidence(ago(49 * H), "schooly", NOW)).toBe("stale");
  });

  it("tolère exactement une exécution manquée, pas deux (limite : 2 × cadence)", () => {
    const interval = expectedIntervalMinutes("sejoura");
    expect(staleAfterMinutes("sejoura")).toBe(interval * 2);
    expect(dataConfidence(ago(interval * 2), "sejoura", NOW)).toBe("fresh"); // à la limite
    expect(dataConfidence(ago(interval * 2 + 1), "sejoura", NOW)).toBe("stale");
  });

  it("un produit passé à l'horaire devient périmé après 2 h (60 × 2)", () => {
    EXPECTED_INTERVAL_MINUTES.test_horaire = 60;
    try {
      expect(dataConfidence(ago(119), "test_horaire", NOW)).toBe("fresh");
      expect(dataConfidence(ago(121), "test_horaire", NOW)).toBe("stale");
    } finally {
      delete EXPECTED_INTERVAL_MINUTES.test_horaire;
    }
  });

  it("produit inconnu ou non précisé → cadence par défaut (quotidienne)", () => {
    expect(expectedIntervalMinutes("nouveau-produit")).toBe(DEFAULT_INTERVAL_MINUTES);
    expect(expectedIntervalMinutes(undefined)).toBe(DEFAULT_INTERVAL_MINUTES);
    expect(expectedIntervalMinutes(null)).toBe(DEFAULT_INTERVAL_MINUTES);
  });

  it("une date légèrement dans le futur (horloges décalées) n'est pas négative", () => {
    expect(syncAgeMinutes(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toBe(0);
    expect(dataConfidence(new Date(NOW + 5 * 60_000).toISOString(), "sejoura", NOW)).toBe("fresh");
  });

  it("formatDuration produit des durées lisibles", () => {
    expect(formatDuration(1)).toBe("1 minute");
    expect(formatDuration(45)).toBe("45 minutes");
    expect(formatDuration(180)).toBe("3 heures");
    expect(formatDuration(2880)).toBe("2 jours");
  });
});

describe("l'intelligence utilise la même règle", () => {
  const metric = (projet: string, derniere_synchro: string | null) =>
    ({ projet, nom: projet, mrr: 1, comptes_actifs: 1, statut_sante: "healthy", derniere_synchro }) as never;
  const staleItems = (m: unknown[]) =>
    buildDeterministicIntelligence(m as never, [], []).filter((i) => i.id.startsWith("stale-") || /synchronisation/i.test(i.message));

  it("aucune alerte « ancienne » pour une donnée de 25 h d'un produit quotidien", () => {
    expect(staleItems([metric("sejoura", new Date(Date.now() - 25 * H * 60_000).toISOString())])).toHaveLength(0);
  });

  it("alerte quand la donnée dépasse 2 × la cadence, avec le délai réel dans le message", () => {
    const items = staleItems([metric("sejoura", new Date(Date.now() - 50 * H * 60_000).toISOString())]);
    expect(items).toHaveLength(1);
    expect(items[0].message).toContain("2 jours");
    expect(items[0].message).not.toContain("30 minutes");
  });
});
