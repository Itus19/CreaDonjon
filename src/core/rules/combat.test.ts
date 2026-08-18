import { describe, expect, it } from "vitest";
import { EmptyCombatError, abilityModifier, advanceTurn, retreatTurn, rollInitiative, sortByInitiative, startCombat } from "./combat";
import { SeededRng } from "../dice/rng";

describe("sortByInitiative", () => {
  it("trie par initiative decroissante", () => {
    const result = sortByInitiative([
      { id: "a", initiative: 12, displayOrder: 1 },
      { id: "b", initiative: 19, displayOrder: 2 },
      { id: "c", initiative: 16, displayOrder: 3 },
    ]);
    expect(result.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("departage une egalite par displayOrder croissant (ordre d'ajout)", () => {
    const result = sortByInitiative([
      { id: "second", initiative: 16, displayOrder: 2 },
      { id: "premier", initiative: 16, displayOrder: 1 },
    ]);
    expect(result.map((p) => p.id)).toEqual(["premier", "second"]);
  });

  it("un participant sans initiative lancee va en dernier", () => {
    const result = sortByInitiative([
      { id: "sans", initiative: null, displayOrder: 1 },
      { id: "avec", initiative: 5, displayOrder: 2 },
    ]);
    expect(result.map((p) => p.id)).toEqual(["avec", "sans"]);
  });

  it("deux participants sans initiative gardent leur ordre d'ajout", () => {
    const result = sortByInitiative([
      { id: "second", initiative: null, displayOrder: 2 },
      { id: "premier", initiative: null, displayOrder: 1 },
    ]);
    expect(result.map((p) => p.id)).toEqual(["premier", "second"]);
  });
});

describe("startCombat", () => {
  it("commence au round 1, premier participant", () => {
    expect(startCombat(4)).toEqual({ round: 1, turnIndex: 0 });
  });

  it("un combat sans participant leve une erreur explicite", () => {
    expect(() => startCombat(0)).toThrow(EmptyCombatError);
  });
});

describe("advanceTurn", () => {
  it("avance au participant suivant dans le meme round", () => {
    expect(advanceTurn({ round: 1, turnIndex: 0 }, 3)).toEqual({ round: 1, turnIndex: 1 });
  });

  it("boucle sur le premier participant et incremente le round en depassant le dernier", () => {
    expect(advanceTurn({ round: 1, turnIndex: 2 }, 3)).toEqual({ round: 2, turnIndex: 0 });
  });

  it("un combat sans participant leve une erreur explicite", () => {
    expect(() => advanceTurn({ round: 1, turnIndex: 0 }, 0)).toThrow(EmptyCombatError);
  });
});

describe("retreatTurn", () => {
  it("recule au participant precedent dans le meme round", () => {
    expect(retreatTurn({ round: 1, turnIndex: 1 }, 3)).toEqual({ round: 1, turnIndex: 0 });
  });

  it("recule au dernier participant du round precedent", () => {
    expect(retreatTurn({ round: 2, turnIndex: 0 }, 3)).toEqual({ round: 1, turnIndex: 2 });
  });

  it("reste sur place au tout premier tour du round 1 (rien avant)", () => {
    expect(retreatTurn({ round: 1, turnIndex: 0 }, 3)).toEqual({ round: 1, turnIndex: 0 });
  });

  it("un combat sans participant leve une erreur explicite", () => {
    expect(() => retreatTurn({ round: 1, turnIndex: 0 }, 0)).toThrow(EmptyCombatError);
  });
});

describe("abilityModifier", () => {
  it("score de 10 ou 11 -> modificateur 0", () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
  });
  it("score de 14 -> modificateur +2", () => {
    expect(abilityModifier(14)).toBe(2);
  });
  it("score de 8 -> modificateur -1", () => {
    expect(abilityModifier(8)).toBe(-1);
  });
});

describe("rollInitiative", () => {
  it("d20 + modificateur, deterministe pour une graine donnee", () => {
    const a = rollInitiative(3, new SeededRng(42));
    const b = rollInitiative(3, new SeededRng(42));
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1 + 3);
    expect(a).toBeLessThanOrEqual(20 + 3);
  });
});
