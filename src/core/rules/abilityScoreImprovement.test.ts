import { describe, expect, it } from "vitest";
import { asiExceedsCap, asiModifiers, isValidAsiChoice, parseAsiChoice } from "./abilityScoreImprovement";

describe("isValidAsiChoice", () => {
  it("accepte +2 sur une seule caracteristique", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 2 } })).toBe(true);
  });

  it("accepte +1 sur deux caracteristiques", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1, con: 1 } })).toBe(true);
  });

  it("refuse un total different de 2", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1 } })).toBe(false);
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 3 } })).toBe(false);
    expect(isValidAsiChoice({ kind: "asi", increases: {} })).toBe(false);
  });

  it("refuse plus de deux caracteristiques touchees", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1, dex: 1, con: 1 } })).toBe(false);
  });

  it("refuse une valeur individuelle hors de {1, 2}", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 0, dex: 2 } })).toBe(false);
  });
});

describe("parseAsiChoice", () => {
  it("reconnait la forme attendue", () => {
    expect(parseAsiChoice({ kind: "asi", increases: { str: 2 } })).toEqual({ kind: "asi", increases: { str: 2 } });
  });

  it("rejette une valeur qui n'est pas un choix d'ASI", () => {
    expect(parseAsiChoice(null)).toBeNull();
    expect(parseAsiChoice({ kind: "skill", chosen: ["arcana"] })).toBeNull();
    expect(parseAsiChoice({ kind: "asi", increases: { str: "deux" } })).toBeNull();
    expect(parseAsiChoice({ kind: "asi", increases: { notAnAbility: 2 } })).toBeNull();
  });
});

describe("asiModifiers", () => {
  it("produit un modificateur additif couche 5 par caracteristique touchee", () => {
    const modifiers = asiModifiers({ kind: "asi", increases: { str: 1, con: 1 } }, "asi:fighter.l4", "ASI (Guerrier niv. 4)");
    expect(modifiers).toEqual(
      expect.arrayContaining([
        { target: "ability.str", op: "add", value: 1, layer: 5, source: "asi:fighter.l4", label: "ASI (Guerrier niv. 4)" },
        { target: "ability.con", op: "add", value: 1, layer: 5, source: "asi:fighter.l4", label: "ASI (Guerrier niv. 4)" },
      ])
    );
    expect(modifiers).toHaveLength(2);
  });
});

describe("asiExceedsCap (plafond du ruleset, V3.1-115)", () => {
  const avant = { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  it("+2 sur 19 dépasse le plafond 20, +1 non", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { str: 2 } }, avant, 20)).toBe(true);
    expect(asiExceedsCap({ kind: "asi", increases: { str: 1, dex: 1 } }, avant, 20)).toBe(false);
  });
  it("lit le plafond du ruleset : au plafond 15, 14 + 2 dépasse", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { dex: 2 } }, { ...avant, dex: 14 }, 15)).toBe(true);
    expect(asiExceedsCap({ kind: "asi", increases: { dex: 2 } }, { ...avant, dex: 13 }, 15)).toBe(false);
  });
  it("une caractéristique déjà au-dessus du plafond ne peut plus monter", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { str: 1, dex: 1 } }, { ...avant, str: 21 }, 20)).toBe(true);
  });
});
