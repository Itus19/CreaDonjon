import { describe, expect, it } from "vitest";
import { emplacementsOfferts, optionsDeLancement, sortsJouables } from "./lancerSort";
import type { ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";


describe("emplacementsOfferts", () => {
  const base = { totaux: { 1: 4, 2: 3, 3: 2 }, depenses: {}, pacte: null, pacteDepense: 0 };

  it("offre les niveaux au moins égaux au niveau de base", () => {
    expect(emplacementsOfferts({ ...base, base: 2 })).toEqual([
      { niveau: 2, restants: 3 },
      { niveau: 3, restants: 2 },
    ]);
  });

  it("retire les niveaux épuisés", () => {
    expect(emplacementsOfferts({ ...base, base: 1, depenses: { 1: 4, 2: 1 } }).map((e) => e.niveau)).toEqual([2, 3]);
  });

  it("ajoute la réserve de pacte à son niveau", () => {
    const r = emplacementsOfferts({ base: 1, totaux: { 1: 1 }, depenses: { 1: 1 }, pacte: { count: 2, slotLevel: 3 }, pacteDepense: 1 });
    expect(r).toEqual([{ niveau: 3, restants: 1 }]);
  });

  it("ne demande aucun emplacement pour un sort mineur", () => {
    expect(emplacementsOfferts({ ...base, base: 0 })).toEqual([]);
  });
});

describe("optionsDeLancement", () => {
  it("rassemble les cast_options des aptitudes", () => {
    const activation = {
      activations: [{ id: "meta", cast_options: [{ id: "twinned", label: { fr: "Sort accéléré" }, cost: { resources: [] }, changes: { action: "bonus" } }] }],
      durable_effects: [],
    } as unknown as ActivationBlockData;
    expect(optionsDeLancement([{ key: "metamagic", activation }, { key: "autre" }])).toEqual([
      { ruleKey: "metamagic", optionId: "twinned", label: { fr: "Sort accéléré" } },
    ]);
  });
});

describe("sortsJouables", () => {
  it("garde les sorts qui ont une activation, triés par nom", () => {
    const avec = { activations: [{ id: "a" }], durable_effects: [] } as unknown as ActivationBlockData;
    const vide = { activations: [], durable_effects: [] } as unknown as ActivationBlockData;
    const r = sortsJouables({ z: avec, a: avec, v: vide }, (c) => c.toUpperCase());
    expect(r.map((s) => s.cle)).toEqual(["a", "z"]);
  });
});
