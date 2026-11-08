import { describe, expect, it } from "vitest";
import { classSpellcastingWithSubclass, subclassSpellBudget, subclassSpellcasting } from "./subclassSpellcasting";
import { computeSpellSlots } from "./spellSlots";
import { characterSheet, type CharacterBuild, type ClassSpellcasting, type ResolvedRuleset } from "./sheet";
import { zSubclassSpellcastingBlockData, type SubclassSpellcastingBlockData } from "../schemas/rule-blocks/blocks";

/**
 * V3.1-185 — une sous-classe qui lance des sorts (Arnaqueur arcanique,
 * Chevalier occulte) : tiers de lanceur, sa propre table d'emplacements.
 */

/** Table « Sorts de l'Arnaqueur arcanique » (MdJ 2024), réduite aux lignes qui changent. */
const ARNAQUEUR: SubclassSpellcastingBlockData = {
  ability: "int",
  caster_weight: { fraction: "third", rounding: "down" },
  slots: [
    { level: 3, counts: [2] },
    { level: 4, counts: [3] },
    { level: 7, counts: [4, 2] },
    { level: 10, counts: [4, 3] },
    { level: 13, counts: [4, 3, 2] },
    { level: 16, counts: [4, 3, 3] },
    { level: 19, counts: [4, 3, 3, 1] },
  ],
};

const MULTICLASS_TABLE: Record<string, number[]> = {
  "1": [2], "2": [3], "3": [4, 2], "4": [4, 3], "5": [4, 3, 2], "6": [4, 3, 3], "7": [4, 3, 3, 1], "8": [4, 3, 3, 2],
};
const WIZARD: ClassSpellcasting = { ability: "int", kind: "slots", casterWeight: { fraction: "full", rounding: "down" }, slotsByLevel: { 3: { 1: 4, 2: 2 } } };

describe("l'incantation d'une sous-classe (V3.1-185)", () => {
  it("la table se lit niveau par niveau : la dernière ligne atteinte vaut", () => {
    const sc = subclassSpellcasting(ARNAQUEUR);
    expect(sc.ability).toBe("int");
    expect(sc.casterWeight).toEqual({ fraction: "third", rounding: "down" });
    expect(sc.slotsByLevel[2]).toBeUndefined();
    expect(sc.slotsByLevel[3]).toEqual({ 1: 2 });
    expect(sc.slotsByLevel[6]).toEqual({ 1: 3 });
    expect(sc.slotsByLevel[7]).toEqual({ 1: 4, 2: 2 });
    expect(sc.slotsByLevel[20]).toEqual({ 1: 4, 2: 3, 3: 3, 4: 1 });
  });

  it("un zéro dans la table ne fait pas d'emplacement", () => {
    expect(subclassSpellcasting({ ...ARNAQUEUR, slots: [{ level: 3, counts: [2, 0] }] }).slotsByLevel[3]).toEqual({ 1: 2 });
  });

  it("la classe qui lance déjà des sorts garde les siens ; sinon la sous-classe lui prête les siens", () => {
    const sub = subclassSpellcasting(ARNAQUEUR);
    expect(classSpellcastingWithSubclass(undefined, sub)).toBe(sub);
    expect(classSpellcastingWithSubclass(WIZARD, sub)).toBe(WIZARD);
    expect(classSpellcastingWithSubclass(undefined, undefined)).toBeUndefined();
  });

  it("tiers de lanceur seul : sa propre table (Arnaqueur 3 : deux emplacements du 1er niveau)", () => {
    const sub = subclassSpellcasting(ARNAQUEUR);
    expect(computeSpellSlots([{ key: "rogue", level: 3, spellcasting: sub }], MULTICLASS_TABLE)).toEqual({ slots: { 1: 2 } });
    expect(computeSpellSlots([{ key: "rogue", level: 2, spellcasting: sub }], MULTICLASS_TABLE)).toEqual({ slots: {} });
  });

  it("multiclassé : le tiers des niveaux, arrondi à l'inférieur (Arnaqueur 8 / magicien 3 : lanceur de niveau 5)", () => {
    const sub = subclassSpellcasting(ARNAQUEUR);
    const r = computeSpellSlots(
      [
        { key: "rogue", level: 8, spellcasting: sub },
        { key: "wizard", level: 3, spellcasting: WIZARD },
      ],
      MULTICLASS_TABLE
    );
    expect(r.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
  });

  it("la fiche d'un Arnaqueur 3 porte ses emplacements, son DD et son attaque de sort", () => {
    const ruleset: ResolvedRuleset = {
      classes: {
        rogue: { key: "rogue", label: "Roublard", hitDie: 8, savingThrowProficiencies: ["dex", "int"], spellcasting: classSpellcastingWithSubclass(undefined, subclassSpellcasting(ARNAQUEUR)) },
      },
      features: {},
    };
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "rogue", level: 3 }],
      abilities: { assigned: { str: 10, dex: 16, con: 12, int: 16, wis: 10, cha: 10 } },
      featureKeys: [],
    };
    const sheet = characterSheet(build, ruleset, [], []);
    expect(sheet.spellcasting?.slots).toEqual({ 1: 2 });
    expect(sheet.spellcasting?.ability).toBe("int");
    // 8 + maîtrise 2 + Int 3 ; attaque +5.
    expect(sheet.spellcasting?.saveDc).toBe(13);
    expect(sheet.spellcasting?.attackBonus).toBe(5);
  });
});

describe("V3.1-190 — le budget de sorts d'une sous-classe lanceuse", () => {
  const AVEC_BUDGET: SubclassSpellcastingBlockData = {
    ...ARNAQUEUR,
    spell_list: "wizard",
    slots: [
      { level: 3, counts: [2], cantrips: 2, prepared: 3 },
      { level: 4, counts: [3], prepared: 4 },
      { level: 7, counts: [4, 2], prepared: 5 },
      { level: 10, counts: [4, 3], cantrips: 3, prepared: 7 },
    ],
  };

  it("la dernière ligne atteinte vaut, colonne par colonne ; le niveau de sort maximal suit les emplacements", () => {
    expect(subclassSpellBudget(AVEC_BUDGET, 2)).toBeNull();
    expect(subclassSpellBudget(AVEC_BUDGET, 3)).toEqual({ spellList: "wizard", ability: "int", cantrips: 2, prepared: 3, maxSpellLevel: 1 });
    expect(subclassSpellBudget(AVEC_BUDGET, 8)).toEqual({ spellList: "wizard", ability: "int", cantrips: 2, prepared: 5, maxSpellLevel: 2 });
    expect(subclassSpellBudget(AVEC_BUDGET, 12)).toEqual({ spellList: "wizard", ability: "int", cantrips: 3, prepared: 7, maxSpellLevel: 2 });
  });

  it("sans liste de sorts déclarée, pas de budget (rien à proposer)", () => {
    expect(subclassSpellBudget(ARNAQUEUR, 5)).toBeNull();
  });

  it("le schéma accepte les colonnes du budget, et les refuse négatives", () => {
    expect(zSubclassSpellcastingBlockData.safeParse(AVEC_BUDGET).success).toBe(true);
    expect(zSubclassSpellcastingBlockData.safeParse({ ...AVEC_BUDGET, slots: [{ level: 3, counts: [2], prepared: -1 }] }).success).toBe(false);
  });
});
