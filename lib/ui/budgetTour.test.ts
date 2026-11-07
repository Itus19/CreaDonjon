import { describe, expect, it } from "vitest";
import { budgetAffiche } from "./budgetTour";

const base = { combat: { round: 3, turnIndex: 1 }, rang: 2, attaquesParAction: 2 };
const neuf = { action: 1, bonus: 1, attacks: 0, extraNotMagic: 0 };

describe("budgetAffiche", () => {
  it("rend un budget neuf quand rien n'est enregistré", () => {
    expect(budgetAffiche({ ...base, budget: null })).toEqual({ action: 1, bonus: 1, attaques: null, depasse: false });
  });

  it("reprend le budget daté du tour en cours", () => {
    const r = budgetAffiche({ ...base, budget: { at: "3:1", action: 0, bonus: 1, attacks: 1, extraNotMagic: 0 } });
    expect(r).toEqual({ action: 0, bonus: 1, attaques: { restantes: 1, total: 2 }, depasse: false });
  });

  it("lit neuf un budget d'un tour passé", () => {
    expect(budgetAffiche({ ...base, budget: { at: "2:1", action: 0, bonus: 0, attacks: 1, extraNotMagic: 0 } })).toEqual({
      action: 1,
      bonus: 1,
      attaques: null,
      depasse: false,
    });
  });

  it("avant son rang dans le round, le tour de référence est celui du round d'avant", () => {
    const r = budgetAffiche({ combat: { round: 3, turnIndex: 0 }, rang: 2, attaquesParAction: null, budget: { at: "2:1", ...neuf, action: 0 } });
    expect(r.action).toBe(0);
  });

  it("compte l'action accordée « pas pour la Magie » et signale un dépassement", () => {
    expect(budgetAffiche({ ...base, budget: { at: "3:1", action: 0, bonus: 1, attacks: 0, extraNotMagic: 1 } }).action).toBe(1);
    const r = budgetAffiche({ ...base, budget: { at: "3:1", action: -1, bonus: 1, attacks: 0, extraNotMagic: 0 } });
    expect(r).toMatchObject({ action: 0, depasse: true });
  });

  it("garde les attaques sans total quand la fiche n'est pas connue", () => {
    const r = budgetAffiche({ ...base, attaquesParAction: null, budget: { at: "3:1", ...neuf, action: 0, attacks: 1 } });
    expect(r.attaques).toEqual({ restantes: 1, total: null });
  });
});
