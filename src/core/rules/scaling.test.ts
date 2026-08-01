import { describe, expect, it } from "vitest";
import { generateScalingTable, resolveScalingTarget } from "./scaling";

describe("generateScalingTable", () => {
  it("renvoie la table telle quelle quand elle est deja presente (cas de l'import SRD)", () => {
    const data = {
      axis: "slot_level" as const,
      base: 3,
      rule: null,
      table: { "3": "8d6", "4": "9d6" },
    };
    expect(generateScalingTable(data, 9)).toEqual({ "3": "8d6", "4": "9d6" });
  });

  it("engendre la table a partir d'une regle reguliere, en fusionnant les des de meme face", () => {
    const data = {
      axis: "slot_level" as const,
      base: 3,
      rule: {
        kind: "delta_per_step" as const,
        target: "effects.e1.formula",
        per_step: { op: "dice" as const, count: 1, faces: 6 },
      },
      table: null,
    };
    const baseFormula = { op: "dice" as const, count: 8, faces: 6 };
    expect(generateScalingTable(data, 5, baseFormula)).toEqual({
      "3": "8d6",
      "4": "9d6",
      "5": "10d6",
    });
  });

  it("cumule des nombres simples de la meme facon", () => {
    const data = {
      axis: "character_level" as const,
      base: 1,
      rule: {
        kind: "delta_per_step" as const,
        target: "effects.e1.formula",
        per_step: { op: "num" as const, value: 1 },
      },
      table: null,
    };
    const baseFormula = { op: "num" as const, value: 2 };
    expect(generateScalingTable(data, 4, baseFormula)).toEqual({
      "1": "2",
      "2": "3",
      "3": "4",
      "4": "5",
    });
  });

  it("retombe sur une addition explicite quand les termes ne se fusionnent pas (faces differentes)", () => {
    const data = {
      axis: "slot_level" as const,
      base: 3,
      rule: {
        kind: "delta_per_step" as const,
        target: "effects.e1.formula",
        per_step: { op: "dice" as const, count: 1, faces: 4 },
      },
      table: null,
    };
    const baseFormula = { op: "dice" as const, count: 8, faces: 6 };
    expect(generateScalingTable(data, 4, baseFormula)).toEqual({
      "3": "8d6",
      "4": "8d6 + 1d4",
    });
  });

  it("ne genere rien sans formule de base pour une regle (rien a afficher plutot qu'une erreur)", () => {
    const data = {
      axis: "slot_level" as const,
      base: 3,
      rule: {
        kind: "delta_per_step" as const,
        target: "effects.e1.formula",
        per_step: { op: "dice" as const, count: 1, faces: 6 },
      },
      table: null,
    };
    expect(generateScalingTable(data, 5)).toEqual({});
  });
});

describe("resolveScalingTarget", () => {
  it("trouve la formule de l'effet designe par son id", () => {
    const effectsData = {
      effects: [{ id: "e1", formula: { op: "dice" as const, count: 8, faces: 6 } }],
    };
    expect(resolveScalingTarget("effects.e1.formula", effectsData)).toEqual({
      op: "dice",
      count: 8,
      faces: 6,
    });
  });

  it("renvoie undefined si l'effet n'existe pas ou n'a pas de formule", () => {
    const effectsData = { effects: [{ id: "e1" }] };
    expect(resolveScalingTarget("effects.e2.formula", effectsData)).toBeUndefined();
    expect(resolveScalingTarget("effects.e1.formula", effectsData)).toBeUndefined();
  });

  it("renvoie undefined pour une cible hors du bloc effects", () => {
    expect(resolveScalingTarget("spell_casting.level", undefined)).toBeUndefined();
  });
});
