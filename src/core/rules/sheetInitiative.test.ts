import { describe, expect, it } from "vitest";
import { characterSheet, type ActiveEffect, type CharacterBuild, type EquippedItem, type Modifier, type ResolvedRuleset } from "./sheet";
import { modifierTargetOption, OPS_BY_TARGET_CATEGORY } from "./modifierTargets";

/**
 * L'initiative (règles 2024) est un test de Dextérité : le modificateur de
 * Dextérité, puis ce qu'une règle pose sur `initiative` (Vigilant : + la
 * maîtrise ; Athlète accompli : l'avantage). Un avantage au test de Dextérité
 * vaut aussi pour elle. Calculée, jamais stockée (règle 16).
 */

const GUERRIER = { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: ["str", "con"] as const };
const ruleset: ResolvedRuleset = { classes: { fighter: GUERRIER }, features: {} };
// Dextérité 14 (+2) ; niveau 3, maîtrise +2.
const build: CharacterBuild = {
  species: "human",
  classes: [{ key: "fighter", level: 3 }],
  abilities: { assigned: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } },
  featureKeys: [],
};

const mod = (target: string, op: Modifier["op"], label: string, value?: number): Modifier => ({
  target,
  op,
  ...(value === undefined ? {} : { value }),
  source: `test:${label}`,
  label,
  layer: 6,
});
const objet = (modifiers: Modifier[]): EquippedItem => ({ key: "o", label: "Objet", equipped: true, modifiers });
const effet = (modifiers: Modifier[]): ActiveEffect => ({ key: "fx", label: "Effet", modifiers });

describe("characterSheet — initiative", () => {
  it("sans rien : le modificateur de Dextérité, sans avantage", () => {
    const s = characterSheet(build, ruleset, [], []);
    expect(s.initiative.mod).toBe(2);
    expect(s.initiative.rollState).toBe("normal");
    expect(s.initiative.sources).toEqual([{ label: "Dextérité", value: 2 }]);
  });

  it("Athlète accompli : l'avantage à l'initiative", () => {
    const s = characterSheet(build, ruleset, [objet([mod("initiative", "advantage", "Athlète accompli")])], []);
    expect(s.initiative.rollState).toBe("advantage");
    expect(s.initiative.mod).toBe(2);
  });

  it("un bonus s'ajoute et se nomme (Vigilant : + la maîtrise)", () => {
    const s = characterSheet(build, ruleset, [objet([mod("initiative", "add", "Vigilant", 2)])], []);
    expect(s.initiative.mod).toBe(4);
    expect(s.initiative.sources).toContainEqual({ label: "Vigilant", value: 2 });
  });

  it("l'initiative est un test de Dextérité : l'avantage ou le désavantage de ce test compte", () => {
    const avec = characterSheet(build, ruleset, [], [effet([mod("check.dex", "advantage", "Agilité")])]);
    expect(avec.initiative.rollState).toBe("advantage");
    const annule = characterSheet(build, ruleset, [objet([mod("initiative", "advantage", "Athlète accompli")])], [effet([mod("check.dex", "disadvantage", "Entravé")])]);
    expect(annule.initiative.rollState).toBe("normal");
  });

  it("la cible se saisit dans l'éditeur : bonus, avantage, désavantage", () => {
    const option = modifierTargetOption("initiative");
    expect(option?.category).toBe("initiative");
    expect(OPS_BY_TARGET_CATEGORY.initiative).toEqual(["add", "advantage", "disadvantage"]);
  });
});
