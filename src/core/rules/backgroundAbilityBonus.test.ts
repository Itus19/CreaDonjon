import { describe, expect, it } from "vitest";
import {
  backgroundAbilityBonusModifiers,
  isValidBackgroundAbilityBonusChoice,
  parseBackgroundAbilityBonusChoice,
} from "./backgroundAbilityBonus";

const SOLDIER_ABILITIES = ["str", "dex", "con"] as const;

describe("isValidBackgroundAbilityBonusChoice", () => {
  it("accepte +2 sur une des trois et +1 sur une autre", () => {
    expect(
      isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2, dex: 1 } }, SOLDIER_ABILITIES)
    ).toBe(true);
  });

  it("accepte +1 sur les trois", () => {
    expect(
      isValidBackgroundAbilityBonusChoice(
        { kind: "background_ability_bonus", increases: { str: 1, dex: 1, con: 1 } },
        SOLDIER_ABILITIES
      )
    ).toBe(true);
  });

  it("refuse une caracteristique hors des trois listees par l'historique", () => {
    expect(
      isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2, wis: 1 } }, SOLDIER_ABILITIES)
    ).toBe(false);
  });

  it("refuse un historique sans caracteristiques connues (ex. SRD 2014)", () => {
    expect(isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2, dex: 1 } }, [])).toBe(false);
  });

  it("refuse deux +1 seuls (ni 2-1, ni 1-1-1)", () => {
    expect(
      isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 1, dex: 1 } }, SOLDIER_ABILITIES)
    ).toBe(false);
  });

  it("refuse deux +2 (jamais deux caracteristiques a +2)", () => {
    expect(
      isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2, dex: 2 } }, SOLDIER_ABILITIES)
    ).toBe(false);
  });

  it("refuse un choix vide ou a une seule caracteristique", () => {
    expect(isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: {} }, SOLDIER_ABILITIES)).toBe(false);
    expect(
      isValidBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2 } }, SOLDIER_ABILITIES)
    ).toBe(false);
  });

  it("refuse les trois a +1 si l'une d'elles est hors liste", () => {
    expect(
      isValidBackgroundAbilityBonusChoice(
        { kind: "background_ability_bonus", increases: { str: 1, dex: 1, wis: 1 } },
        SOLDIER_ABILITIES
      )
    ).toBe(false);
  });
});

describe("parseBackgroundAbilityBonusChoice", () => {
  it("reconnait la forme attendue", () => {
    expect(parseBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: 2, dex: 1 } })).toEqual({
      kind: "background_ability_bonus",
      increases: { str: 2, dex: 1 },
    });
  });

  it("rejette une valeur qui n'est pas ce choix", () => {
    expect(parseBackgroundAbilityBonusChoice(null)).toBeNull();
    expect(parseBackgroundAbilityBonusChoice({ kind: "asi", increases: { str: 2 } })).toBeNull();
    expect(parseBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { str: "deux" } })).toBeNull();
    expect(parseBackgroundAbilityBonusChoice({ kind: "background_ability_bonus", increases: { notAnAbility: 1 } })).toBeNull();
  });
});

describe("backgroundAbilityBonusModifiers", () => {
  it("produit un modificateur additif couche 4 par caracteristique touchee", () => {
    const modifiers = backgroundAbilityBonusModifiers(
      { kind: "background_ability_bonus", increases: { str: 2, dex: 1 } },
      "background:soldier",
      "Soldat"
    );
    expect(modifiers).toEqual(
      expect.arrayContaining([
        { target: "ability.str", op: "add", value: 2, layer: 4, source: "background:soldier", label: "Soldat" },
        { target: "ability.dex", op: "add", value: 1, layer: 4, source: "background:soldier", label: "Soldat" },
      ])
    );
    expect(modifiers).toHaveLength(2);
  });
});
