import { describe, expect, it } from "vitest";
import { computeSpellSlots, type CastingClass } from "./spellSlots";
import { rechargeTrackers } from "./resourceRecharge";
import { characterSheet, type CharacterBuild, type ClassSpellcasting, type ResolvedRuleset } from "./sheet";

/** Table « Incantateur multiclassé » du SRD 5.2.1, telle que `data/srd/character-rules.json` la porte. */
const MULTICLASS_TABLE: Record<string, number[]> = {
  "1": [2], "2": [3], "3": [4, 2], "4": [4, 3], "5": [4, 3, 2], "6": [4, 3, 3], "7": [4, 3, 3, 1], "8": [4, 3, 3, 2],
  "9": [4, 3, 3, 3, 1], "10": [4, 3, 3, 3, 2], "11": [4, 3, 3, 3, 2, 1], "12": [4, 3, 3, 3, 2, 1],
  "13": [4, 3, 3, 3, 2, 1, 1], "14": [4, 3, 3, 3, 2, 1, 1], "15": [4, 3, 3, 3, 2, 1, 1, 1], "16": [4, 3, 3, 3, 2, 1, 1, 1],
  "17": [4, 3, 3, 3, 2, 1, 1, 1, 1], "18": [4, 3, 3, 3, 3, 1, 1, 1, 1], "19": [4, 3, 3, 3, 3, 2, 1, 1, 1], "20": [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

const FULL: ClassSpellcasting["casterWeight"] = { fraction: "full", rounding: "down" };
const HALF_UP: ClassSpellcasting["casterWeight"] = { fraction: "half", rounding: "up" };

/** Tables de classe réduites aux niveaux lus par les tests. */
const CLERIC: ClassSpellcasting = { ability: "wis", kind: "slots", casterWeight: FULL, slotsByLevel: { 2: { 1: 3 }, 3: { 1: 4, 2: 2 } } };
const WIZARD: ClassSpellcasting = { ability: "int", kind: "slots", casterWeight: FULL, slotsByLevel: { 2: { 1: 3 }, 3: { 1: 4, 2: 2 } } };
const PALADIN: ClassSpellcasting = { ability: "cha", kind: "slots", casterWeight: HALF_UP, slotsByLevel: { 1: { 1: 2 }, 3: { 1: 3 } } };
const WARLOCK: ClassSpellcasting = {
  ability: "cha",
  kind: "pact",
  slotsByLevel: { 1: { 1: 1 }, 2: { 1: 2 }, 5: { 3: 2 }, 11: { 5: 3 }, 20: { 5: 4 } },
};

function casting(...entries: [string, number, ClassSpellcasting][]): CastingClass[] {
  return entries.map(([key, level, spellcasting]) => ({ key, level, spellcasting }));
}

describe("emplacements de sort (V3.1-113, ADR 0045)", () => {
  it("une seule classe incantatrice : sa propre table", () => {
    expect(computeSpellSlots(casting(["cleric", 3, CLERIC]), MULTICLASS_TABLE)).toEqual({ slots: { 1: 4, 2: 2 } });
  });

  it("clerc 3 / magicien 2 : les emplacements d'un lanceur de niveau 5", () => {
    expect(computeSpellSlots(casting(["cleric", 3, CLERIC], ["wizard", 2, WIZARD]), MULTICLASS_TABLE)).toEqual({ slots: { 1: 4, 2: 3, 3: 2 } });
  });

  it("2024 : la moitié des niveaux de paladin, arrondie au SUPÉRIEUR (paladin 3 compte 2)", () => {
    // magicien 2 + paladin 3 (2) = 4
    expect(computeSpellSlots(casting(["wizard", 2, WIZARD], ["paladin", 3, PALADIN]), MULTICLASS_TABLE).slots).toEqual({ 1: 4, 2: 3 });
  });

  it("2014 : la même moitié, arrondie à l'INFÉRIEUR (paladin 3 compte 1)", () => {
    const paladin2014: ClassSpellcasting = { ...PALADIN, casterWeight: { fraction: "half", rounding: "down" } };
    expect(computeSpellSlots(casting(["wizard", 2, WIZARD], ["paladin", 3, paladin2014]), MULTICLASS_TABLE).slots).toEqual({ 1: 4, 2: 2 });
  });

  it("occultiste 20 : 4 emplacements de pacte de niveau 5, aucun emplacement ordinaire", () => {
    expect(computeSpellSlots(casting(["warlock", 20, WARLOCK]), MULTICLASS_TABLE)).toEqual({ slots: {}, pact: { count: 4, slotLevel: 5 } });
  });

  it("un multiclassé occultiste garde deux réserves", () => {
    expect(computeSpellSlots(casting(["cleric", 3, CLERIC], ["warlock", 5, WARLOCK]), MULTICLASS_TABLE)).toEqual({
      slots: { 1: 4, 2: 2 },
      pact: { count: 2, slotLevel: 3 },
    });
  });

  it("plusieurs classes incantatrices sans table du multiclassé : aucun emplacement inventé, un avertissement", () => {
    const r = computeSpellSlots(casting(["cleric", 3, CLERIC], ["wizard", 2, WIZARD]), undefined);
    expect(r.slots).toEqual({});
    expect(r.missingMulticlassTable).toBe(true);
  });

  it("une classe sans emplacement à son niveau ne compte pas comme incantatrice (paladin 1 de 2014)", () => {
    const paladin2014: ClassSpellcasting = { ...PALADIN, casterWeight: { fraction: "half", rounding: "down" }, slotsByLevel: { 2: { 1: 2 } } };
    expect(computeSpellSlots(casting(["wizard", 3, WIZARD], ["paladin", 1, paladin2014]), MULTICLASS_TABLE)).toEqual({ slots: { 1: 4, 2: 2 } });
  });
});

describe("la fiche calculée porte les deux réserves", () => {
  it("occultiste 3 / clerc 3 : emplacements de clerc et réserve de pacte", () => {
    const ruleset: ResolvedRuleset = {
      classes: {
        warlock: { key: "warlock", label: "Occultiste", hitDie: 8, savingThrowProficiencies: ["wis", "cha"], spellcasting: { ...WARLOCK, slotsByLevel: { 3: { 2: 2 } } } },
        cleric: { key: "cleric", label: "Clerc", hitDie: 8, savingThrowProficiencies: [], spellcasting: CLERIC },
      },
      features: {},
      characterRules: {
        level_cap: 20,
        ability_score_cap: 20,
        ability_generation: {},
        encumbrance: { capacity_per_strength_lb: 15, tiers: [] },
        sell_ratio: 0.5,
        multiclass_spell_slots: MULTICLASS_TABLE,
      },
    };
    const build: CharacterBuild = {
      species: "human",
      classes: [
        { key: "warlock", level: 3 },
        { key: "cleric", level: 3 },
      ],
      abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 16 } },
      featureKeys: [],
    };
    const sheet = characterSheet(build, ruleset, [], []);
    expect(sheet.spellcasting?.slots).toEqual({ 1: 4, 2: 2 });
    expect(sheet.spellcasting?.pactSlots).toEqual({ count: 2, slotLevel: 2 });
  });
});

describe("recharge des compteurs au repos (V3.1-113)", () => {
  const trackers = [
    { id: "rage", recharge: "short_rest_one" as const },
    { id: "second-wind", recharge: "short_rest" as const },
    { id: "lay-on-hands", recharge: "long_rest" as const },
    { id: "wand", recharge: "dawn" as const },
  ];
  const used = { rage: 3, "second-wind": 1, "lay-on-hands": 4, wand: 2 };

  it("repos court : une Rage rendue, le Second souffle en entier, rien d'autre", () => {
    expect(rechargeTrackers(trackers, used, "short")).toEqual({ rage: 2, "second-wind": 0, "lay-on-hands": 4, wand: 2 });
  });

  it("repos long : toutes les Rages et tout ce qui se recharge au repos", () => {
    expect(rechargeTrackers(trackers, used, "long")).toEqual({ rage: 0, "second-wind": 0, "lay-on-hands": 0, wand: 2 });
  });

  it("une Rage déjà entière reste à zéro utilisation", () => {
    expect(rechargeTrackers(trackers, { rage: 0 }, "short").rage).toBe(0);
  });
});
