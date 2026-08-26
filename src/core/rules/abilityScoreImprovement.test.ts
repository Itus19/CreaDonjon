import { describe, expect, it } from "vitest";
import { asiModifiers, isValidAsiChoice, parseAsiChoice } from "./abilityScoreImprovement";

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
