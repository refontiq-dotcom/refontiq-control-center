import { describe, expect, it } from "vitest";
import {
  isRecurringRevenue,
  mrrDelta,
  mrrTrendByDay,
  revenueModel,
  sumRecurringMrr,
} from "@/lib/revenue-model";
import { buildDeterministicIntelligence } from "@/lib/intelligence";

describe("modèle de revenu : le MRR ne concerne que les abonnements", () => {
  it("Séjoura et Docly sont récurrents ; Schooly, Trouvetou et l'inconnu ne le sont pas", () => {
    expect(isRecurringRevenue("sejoura")).toBe(true);
    expect(isRecurringRevenue("docly")).toBe(true);
    expect(isRecurringRevenue("schooly")).toBe(false);
    expect(isRecurringRevenue("trouvetou")).toBe(false);
    expect(isRecurringRevenue("nouveau-produit")).toBe(false); // jamais compté par défaut
    expect(isRecurringRevenue(undefined)).toBe(false);
    expect(revenueModel("schooly").label).toBe("1 000 F par élève");
  });

  it("le total n'additionne QUE les abonnements (régression : Schooly ne gonfle plus le MRR)", () => {
    const metrics = [
      { projet: "sejoura", mrr: 125000 },
      { projet: "schooly", mrr: 400000 }, // commissions cumulées : ce n'est pas un MRR
      { projet: "trouvetou", mrr: 90000 },
      { projet: "docly", mrr: 15000 },
    ];
    expect(sumRecurringMrr(metrics)).toBe(140000);
  });

  it("valeurs invalides ignorées, total toujours un nombre", () => {
    expect(sumRecurringMrr([{ projet: "sejoura", mrr: Number.NaN }, { projet: "docly", mrr: 5 }])).toBe(5);
    expect(sumRecurringMrr([])).toBe(0);
  });

  it("la variation de MRR n'existe que pour un produit à abonnement", () => {
    expect(mrrDelta({ projet: "sejoura", mrr: 130 }, { mrr: 100 })).toBe(30);
    expect(mrrDelta({ projet: "schooly", mrr: 130 }, { mrr: 100 })).toBeNull();
    expect(mrrDelta(null, { mrr: 100 })).toBeNull();
    expect(mrrDelta({ projet: "sejoura", mrr: 1 }, undefined)).toBeNull();
  });
});

describe("tendance du MRR par jour", () => {
  const snap = (projet: string, mrr: number, at: string) => ({ projet, mrr, captured_at: at });

  it("garde le DERNIER instantané du jour : 24 envois horaires ne multiplient pas le MRR par 24", () => {
    const hourly = Array.from({ length: 24 }, (_, h) =>
      snap("sejoura", 125000, `2026-10-21T${String(h).padStart(2, "0")}:00:00Z`)
    );
    expect(mrrTrendByDay(hourly)).toEqual([{ day: "2026-10-21", mrr: 125000 }]);
  });

  it("le dernier envoi de la journée l'emporte, quel que soit l'ordre d'arrivée", () => {
    const out = mrrTrendByDay([
      snap("sejoura", 130000, "2026-10-21T18:00:00Z"),
      snap("sejoura", 100000, "2026-10-21T06:00:00Z"),
    ]);
    expect(out).toEqual([{ day: "2026-10-21", mrr: 130000 }]);
  });

  it("additionne les produits à abonnement d'un même jour, exclut les autres, trie par date", () => {
    const out = mrrTrendByDay([
      snap("sejoura", 100, "2026-10-22T10:00:00Z"),
      snap("docly", 20, "2026-10-22T11:00:00Z"),
      snap("schooly", 9999, "2026-10-22T11:00:00Z"),
      snap("sejoura", 90, "2026-10-21T10:00:00Z"),
    ]);
    expect(out).toEqual([{ day: "2026-10-21", mrr: 90 }, { day: "2026-10-22", mrr: 120 }]);
  });

  it("ignore les dates invalides", () => {
    expect(mrrTrendByDay([snap("sejoura", 5, "n'importe quoi"), snap("sejoura", 7, "")])).toEqual([]);
  });
});

describe("alerte « MRR en baisse » : seulement pour un abonnement", () => {
  const metric = (projet: string) =>
    ({ projet, nom: projet, mrr: 0, comptes_actifs: 1, statut_sante: "healthy", derniere_synchro: new Date().toISOString() }) as never;
  const prev = (projet: string) => ({ projet, nom: projet, mrr: 5000, comptes_actifs: 1, statut_sante: "healthy", captured_at: "2026-10-20T00:00:00Z" }) as never;
  const drops = (projet: string) =>
    buildDeterministicIntelligence([metric(projet)], [prev(projet)], []).filter((i) => i.id === `drop-mrr-${projet}`);

  it("Séjoura (abonnements) : de 5 000 à 0 déclenche l'alerte", () => expect(drops("sejoura")).toHaveLength(1));
  it("Schooly (par inscription) : une valeur « mrr » qui tombe à 0 ne déclenche rien", () => expect(drops("schooly")).toHaveLength(0));
});
