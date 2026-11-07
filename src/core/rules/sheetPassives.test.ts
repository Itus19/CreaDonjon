import { describe, expect, it } from "vitest";
import { characterSheet, PASSIVE_SKILLS, type ActiveEffect, type CharacterBuild, type EquippedItem, type Modifier, type ResolvedRuleset } from "./sheet";
import { MODIFIER_TARGET_OPTIONS, OPS_BY_TARGET_CATEGORY } from "./modifierTargets";

/**
 * V3.1-167 — les valeurs passives (règles 2024) : 10 + le modificateur de la
 * compétence ; +5 avec l'avantage, −5 avec le désavantage ; puis les bonus
 * qu'une règle pose sur `passive.<compétence>`. Perception, Intuition et
 * Investigation. Calculées, jamais stockées (règle 16).
 */

const ROUBLARD = { key: "rogue", label: "Roublard", hitDie: 8, savingThrowProficiencies: ["dex", "int"] as const };
const ruleset: ResolvedRuleset = { classes: { rogue: ROUBLARD }, features: {} };
// Sagesse 14 (+2), Intelligence 12 (+1) ; niveau 1, maîtrise +2.
const build: CharacterBuild = {
  species: "human",
  classes: [{ key: "rogue", level: 1 }],
  abilities: { assigned: { str: 10, dex: 16, con: 12, int: 12, wis: 14, cha: 8 } },
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

describe("characterSheet — valeurs passives (V3.1-167)", () => {
  it("les trois valeurs passives existent : Perception, Intuition, Investigation", () => {
    expect([...PASSIVE_SKILLS]).toEqual(["perception", "insight", "investigation"]);
    const s = characterSheet(build, ruleset, [], []);
    expect(Object.keys(s.passives).sort()).toEqual(["insight", "investigation", "perception"]);
  });

  it("sans rien : 10 + le modificateur de la compétence, et la source le dit", () => {
    const s = characterSheet(build, ruleset, [], []);
    expect(s.passives.perception.value).toBe(12); // Sagesse +2
    expect(s.passives.insight.value).toBe(12); // Sagesse +2
    expect(s.passives.investigation.value).toBe(11); // Intelligence +1
    expect(s.passives.perception.sources).toEqual([
      { label: "Base", value: 10 },
      { label: "Perception", value: 2 },
    ]);
  });

  it("la maîtrise de la compétence compte (elle est dans son modificateur)", () => {
    const s = characterSheet(build, ruleset, [objet([mod("skill.perception", "proficiency", "Maîtrise")])], []);
    expect(s.skills.perception.mod).toBe(4);
    expect(s.passives.perception.value).toBe(14);
  });

  it("l'avantage sur la compétence donne +5, le désavantage −5", () => {
    const avec = characterSheet(build, ruleset, [], [effet([mod("skill.perception", "advantage", "Œil vif")])]);
    expect(avec.passives.perception.value).toBe(17);
    expect(avec.passives.perception.rollState).toBe("advantage");
    expect(avec.passives.perception.sources).toContainEqual({ label: "Avantage", value: 5 });

    const sans = characterSheet(build, ruleset, [], [effet([mod("check.wis", "disadvantage", "Empoisonné")])]);
    expect(sans.passives.insight.value).toBe(7);
    expect(sans.passives.insight.rollState).toBe("disadvantage");
  });

  it("avantage et désavantage ensemble s'annulent", () => {
    const s = characterSheet(build, ruleset, [], [effet([mod("skill.perception", "advantage", "A"), mod("skill.perception", "disadvantage", "D")])]);
    expect(s.passives.perception.value).toBe(12);
    expect(s.passives.perception.rollState).toBe("normal");
  });

  it("une règle peut viser la valeur passive seule (`passive.<compétence>`)", () => {
    const s = characterSheet(build, ruleset, [objet([mod("passive.investigation", "add", "Loupe du sage", 5)])], []);
    expect(s.passives.investigation.value).toBe(16);
    expect(s.skills.investigation.mod).toBe(1); // le jet actif, lui, ne bouge pas
    expect(s.passives.investigation.sources).toContainEqual({ label: "Loupe du sage", value: 5 });
  });

  it("le catalogue des cibles propose les trois valeurs passives, en « ajouter » seulement", () => {
    const passives = MODIFIER_TARGET_OPTIONS.filter((o) => o.category === "passive").map((o) => o.target);
    expect(passives).toEqual(["passive.perception", "passive.insight", "passive.investigation"]);
    expect(OPS_BY_TARGET_CATEGORY.passive).toEqual(["add"]);
  });
});
