import { describe, expect, it } from "vitest";
import { DEDUP_WINDOW_MS, evaluateMonitoring, planNotifications, type HistoryRow, type MetricRow } from "@/lib/monitoring";

const NOW = Date.parse("2026-10-26T09:30:00Z");
const H = 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const row = (projet: string, ageMs: number, extra: Partial<MetricRow> = {}): MetricRow => ({ projet, nom: projet, statut_sante: "healthy", derniere_synchro: ago(ageMs), ...extra });

describe("évaluation : qu'est-ce qui ne va pas ?", () => {
  it("tout est frais : aucun constat", () => {
    expect(evaluateMonitoring([row("sejoura", 2 * H), row("schooly", 30 * H)], NOW)).toEqual([]);
  });

  it("produit quotidien : 47 h tolérées (une exécution manquée), 49 h = avertissement", () => {
    expect(evaluateMonitoring([row("sejoura", 47 * H), row("schooly", 1 * H)], NOW)).toEqual([]);
    const f = evaluateMonitoring([row("sejoura", 49 * H), row("schooly", 1 * H)], NOW);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ projet: "sejoura", kind: "stale", severity: "warning", key: "monitor:sejoura:stale:warning" });
  });

  it("devient CRITIQUE au-delà de 3 × le délai toléré (le cas réel : Schooly muet depuis 36 jours)", () => {
    const f = evaluateMonitoring([row("sejoura", 1 * H), row("schooly", 36 * 24 * H)], NOW);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ projet: "schooly", severity: "critical", key: "monitor:schooly:stale:critical" });
    expect(f[0].title).toContain("36 jours");
  });

  it("limite exacte : 3 × 48 h = encore « warning », 1 minute de plus = critique", () => {
    expect(evaluateMonitoring([row("sejoura", 144 * H), row("schooly", 1 * H)], NOW)[0].severity).toBe("warning");
    expect(evaluateMonitoring([row("sejoura", 144 * H + 60_000), row("schooly", 1 * H)], NOW)[0].severity).toBe("critical");
  });

  it("aucune ligne, ou date illisible → « missing » critique (jamais « tout va bien »)", () => {
    const a = evaluateMonitoring([row("schooly", 1 * H)], NOW);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ projet: "sejoura", kind: "missing", severity: "critical" });
    const b = evaluateMonitoring([row("sejoura", 1 * H, { derniere_synchro: "n'importe quoi" }), row("schooly", 1 * H)], NOW);
    expect(b[0]).toMatchObject({ projet: "sejoura", kind: "missing" });
    const c = evaluateMonitoring([row("sejoura", 1 * H, { derniere_synchro: null }), row("schooly", 1 * H)], NOW);
    expect(c[0].kind).toBe("missing");
  });

  it("état critique déclaré par le produit : constat distinct, même si les données sont fraîches", () => {
    const f = evaluateMonitoring([row("sejoura", 1 * H, { statut_sante: "critical" }), row("schooly", 1 * H)], NOW);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "unhealthy", severity: "critical" });
  });

  it("seuls les produits surveillés comptent : Docly et Trouvetou ne déclenchent rien", () => {
    expect(evaluateMonitoring([row("sejoura", 1 * H), row("schooly", 1 * H), row("docly", 999 * H), row("trouvetou", 999 * H)], NOW)).toEqual([]);
  });

  it("aucun message ne contient de secret ni de valeur métier", () => {
    const text = JSON.stringify(evaluateMonitoring([], NOW));
    expect(text).not.toMatch(/secret=|token|Bearer|ghp_|eyJ/i);
  });
});

describe("décision : faut-il notifier ?", () => {
  const stale = evaluateMonitoring([row("sejoura", 60 * H), row("schooly", 1 * H)], NOW); // warning sejoura
  const h = (type: string, ageMs: number, status = "sent"): HistoryRow => ({ type, created_at: ago(ageMs), status });

  it("premier constat : notifié", () => {
    const { toSend, skippedDuplicates } = planNotifications(stale, [], NOW);
    expect(toSend).toHaveLength(1);
    expect(toSend[0]).toMatchObject({ type: "monitor:sejoura:stale:warning", level: "warning" });
    expect(skippedDuplicates).toBe(0);
  });

  it("même constat déjà notifié il y a moins de 24 h : PAS de spam", () => {
    const { toSend, skippedDuplicates } = planNotifications(stale, [h("monitor:sejoura:stale:warning", 2 * H)], NOW);
    expect(toSend).toEqual([]);
    expect(skippedDuplicates).toBe(1);
  });

  it("rappel quotidien : au-delà de 24 h le constat toujours présent est renotifié", () => {
    const { toSend } = planNotifications(stale, [h("monitor:sejoura:stale:warning", DEDUP_WINDOW_MS + 60_000)], NOW);
    expect(toSend).toHaveLength(1);
  });

  it("une tentative en ÉCHEC ne compte pas comme notifiée (elle sera retentée)", () => {
    const { toSend } = planNotifications(stale, [h("monitor:sejoura:stale:warning", 1 * H, "failed")], NOW);
    expect(toSend).toHaveLength(1);
  });

  it("aggravation warning → critique : notifiée tout de suite malgré l'alerte récente", () => {
    const critical = evaluateMonitoring([row("sejoura", 200 * H), row("schooly", 1 * H)], NOW);
    const { toSend } = planNotifications(critical, [h("monitor:sejoura:stale:warning", 1 * H)], NOW);
    expect(toSend).toHaveLength(1);
    expect(toSend[0]).toMatchObject({ type: "monitor:sejoura:stale:critical", level: "critical" });
  });

  it("retour à la normale : annoncé UNE fois, puis plus", () => {
    const ok = evaluateMonitoring([row("sejoura", 1 * H), row("schooly", 1 * H)], NOW);
    const first = planNotifications(ok, [h("monitor:sejoura:stale:critical", 30 * H)], NOW);
    expect(first.toSend).toHaveLength(1);
    expect(first.toSend[0]).toMatchObject({ type: "monitor:sejoura:recovered", level: "success" });
    const second = planNotifications(ok, [h("monitor:sejoura:stale:critical", 30 * H), h("monitor:sejoura:recovered", 1 * H)], NOW);
    expect(second.toSend).toEqual([]);
  });

  it("horodatages identiques : le « retour à la normale » l'emporte, il n'est pas réannoncé", () => {
    const ok = evaluateMonitoring([row("sejoura", 1 * H), row("schooly", 1 * H)], NOW);
    const same = ago(1 * H);
    const hist: HistoryRow[] = [
      { type: "monitor:sejoura:stale:critical", created_at: same, status: "sent" },
      { type: "monitor:sejoura:recovered", created_at: same, status: "sent" },
    ];
    expect(planNotifications(ok, hist, NOW).toSend).toEqual([]);
    expect(planNotifications(ok, [...hist].reverse(), NOW).toSend).toEqual([]); // quel que soit l'ordre de lecture
  });

  it("jamais d'annonce de retour à la normale sans incident préalable", () => {
    const ok = evaluateMonitoring([row("sejoura", 1 * H), row("schooly", 1 * H)], NOW);
    expect(planNotifications(ok, [], NOW).toSend).toEqual([]);
  });

  it("un incident d'un produit n'annonce pas le retour de l'autre", () => {
    const both = evaluateMonitoring([row("sejoura", 60 * H), row("schooly", 1 * H)], NOW);
    const { toSend } = planNotifications(both, [h("monitor:schooly:stale:warning", 30 * H)], NOW);
    expect(toSend.map((n) => n.type).sort()).toEqual(["monitor:schooly:recovered", "monitor:sejoura:stale:warning"]);
  });
});
