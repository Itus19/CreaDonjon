import { describe, expect, it } from "vitest";
import { planResourceRegain } from "./resourceRegain";
import type { SheetResource } from "./sheet";

/**
 * ADR 0078 (V3.1-183) — regagner une utilisation d'une ressource en dépensant
 * autre chose. Pur : décide si c'est possible et rend le changement d'état de
 * jeu ; le serveur l'applique (le client n'envoie qu'une intention).
 */

const inspiration: SheetResource = { key: "bardic-inspiration", label: { fr: "Inspiration bardique" }, max: 3, recharge: "long_rest", source: "bard-bardic-inspiration" };
const magie: SheetResource = {
  key: "magie-envoutante",
  label: { fr: "Magie envoûtante" },
  max: 1,
  recharge: "long_rest",
  regain: { kind: "resource", key: "bardic-inspiration", amount: 1 },
  source: "seduction-magie-envoutante",
};
const majeste: SheetResource = { key: "mante-de-majeste", label: { fr: "Mante de majesté" }, max: 1, recharge: "long_rest", regain: { kind: "slot", min_level: 3 }, source: "x" };
const ressources = [inspiration, magie, majeste];
const emplacements = { totals: { 1: 4, 2: 3, 3: 3, 4: 1 }, used: { "3": 3 } };

describe("planResourceRegain — contre une autre ressource", () => {
  it("vide, elle regagne une utilisation contre une Inspiration bardique", () => {
    const r = planResourceRegain({ resourceKey: "magie-envoutante", resources: ressources, used: { "magie-envoutante": 1, "bardic-inspiration": 1 }, slots: emplacements });
    expect(r).toEqual({ ok: true, resources: { "magie-envoutante": 0, "bardic-inspiration": 2 }, spent: { kind: "resource", key: "bardic-inspiration", amount: 1 } });
  });

  it("pleine, rien à regagner", () => {
    expect(planResourceRegain({ resourceKey: "magie-envoutante", resources: ressources, used: {}, slots: emplacements })).toEqual({ ok: false, reason: "full" });
  });

  it("sans Inspiration restante, refusé", () => {
    expect(planResourceRegain({ resourceKey: "magie-envoutante", resources: ressources, used: { "magie-envoutante": 1, "bardic-inspiration": 3 }, slots: emplacements })).toEqual({ ok: false, reason: "cannot_pay" });
  });

  it("une ressource sans regain, ou inconnue, est refusée", () => {
    expect(planResourceRegain({ resourceKey: "bardic-inspiration", resources: ressources, used: { "bardic-inspiration": 1 }, slots: emplacements })).toEqual({ ok: false, reason: "no_regain" });
    expect(planResourceRegain({ resourceKey: "absente", resources: ressources, used: {}, slots: emplacements })).toEqual({ ok: false, reason: "no_regain" });
  });
});

describe("planResourceRegain — contre un emplacement de sort", () => {
  it("dépense le plus petit emplacement libre au niveau minimal ou au-dessus (le 3 est épuisé : le 4)", () => {
    const r = planResourceRegain({ resourceKey: "mante-de-majeste", resources: ressources, used: { "mante-de-majeste": 1 }, slots: emplacements });
    expect(r).toEqual({ ok: true, resources: { "mante-de-majeste": 0 }, spellSlotsUsed: { "3": 3, "4": 1 }, spent: { kind: "slot", level: 4 } });
  });

  it("un niveau demandé est respecté s'il est assez haut et libre", () => {
    const r = planResourceRegain({ resourceKey: "mante-de-majeste", resources: ressources, used: { "mante-de-majeste": 1 }, slots: { totals: { 3: 2, 5: 1 }, used: {} }, slotLevel: 5 });
    expect(r).toMatchObject({ ok: true, spent: { kind: "slot", level: 5 }, spellSlotsUsed: { "5": 1 } });
  });

  it("un niveau trop bas, ou plus aucun emplacement assez haut, est refusé", () => {
    expect(planResourceRegain({ resourceKey: "mante-de-majeste", resources: ressources, used: { "mante-de-majeste": 1 }, slots: emplacements, slotLevel: 2 })).toEqual({ ok: false, reason: "cannot_pay" });
    expect(planResourceRegain({ resourceKey: "mante-de-majeste", resources: ressources, used: { "mante-de-majeste": 1 }, slots: { totals: { 1: 4, 2: 3 }, used: {} } })).toEqual({ ok: false, reason: "cannot_pay" });
  });
});
