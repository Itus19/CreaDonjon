import { describe, expect, it } from "vitest";
import { CHECK_TIERS, autoSuccess, dcForTier, zCheckClassification } from "./checkDifficulty";

describe("du palier au DD (V3.2-22, ADR 0113)", () => {
  it("suit la table de D&D 2024 : 5, 10, 15, 20, 25, 30", () => {
    expect(CHECK_TIERS.map(dcForTier)).toEqual([5, 10, 15, 20, 25, 30]);
  });
});

describe("la réussite automatique", () => {
  it("+5 contre « très facile » (DD 5) : le pire jet réussit", () => {
    expect(autoSuccess({ tier: "tres_facile", modifier: 5 })).toBe(true);
  });

  it("+4 contre « très facile » : le pire jet réussit encore (1 + 4 = 5)", () => {
    expect(autoSuccess({ tier: "tres_facile", modifier: 4 })).toBe(true);
  });

  it("+3 contre « facile » (DD 10) : il faut lancer", () => {
    expect(autoSuccess({ tier: "facile", modifier: 3 })).toBe(false);
  });

  it("un modificateur négatif ne réussit jamais d'office", () => {
    expect(autoSuccess({ tier: "tres_facile", modifier: -1 })).toBe(false);
  });
});

describe("le classement rendu par le modèle", () => {
  it("accepte les trois formes", () => {
    expect(zCheckClassification.safeParse({ kind: "none" }).success).toBe(true);
    expect(zCheckClassification.safeParse({ kind: "trivial" }).success).toBe(true);
    expect(zCheckClassification.safeParse({ kind: "check", action_id: "persuasion", tier: "moyen" }).success).toBe(true);
  });

  it("refuse un palier inconnu, un DD chiffré ou une action vide", () => {
    expect(zCheckClassification.safeParse({ kind: "check", action_id: "persuasion", tier: "enorme" }).success).toBe(false);
    expect(zCheckClassification.safeParse({ kind: "check", action_id: "persuasion", tier: "moyen", dc: 12 }).success).toBe(false);
    expect(zCheckClassification.safeParse({ kind: "check", action_id: "", tier: "moyen" }).success).toBe(false);
  });

  it("refuse un `check` sans palier", () => {
    expect(zCheckClassification.safeParse({ kind: "check", action_id: "persuasion" }).success).toBe(false);
  });
});
