import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zCharacterRulesBlockData } from "../schemas/rule-blocks/characterRules";

/** V3.1-115 — `data/srd/character-rules.json` est de la DONNÉE saisie à la main : chaque ruleset officiel doit y avoir des règles valides. */
const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/character-rules.json"), "utf-8")) as Record<string, { _regle?: string; character_rules?: unknown }>;

describe("règles de personnage des rulesets officiels", () => {
  for (const baseSystem of ["dnd_srd_52", "dnd_srd_51"]) {
    it(`${baseSystem} : un bloc character_rules valide, documenté`, () => {
      expect(RAW[baseSystem]?._regle).toBeTruthy();
      const parsed = zCharacterRulesBlockData.safeParse(RAW[baseSystem]?.character_rules);
      expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
    });
  }

  it("2024 : charge Force × 15 lb sans palier, plafond 20, table du multiclassé complète", () => {
    const r = zCharacterRulesBlockData.parse(RAW.dnd_srd_52.character_rules);
    expect(r.encumbrance).toEqual({ capacity_per_strength_lb: 15, tiers: [] });
    expect(r.ability_score_cap).toBe(20);
    expect(Object.keys(r.multiclass_spell_slots ?? {})).toHaveLength(20);
    expect(r.multiclass_spell_slots?.["5"]).toEqual([4, 3, 2]);
  });
});
