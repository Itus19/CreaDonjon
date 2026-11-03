import { describe, expect, it } from "vitest";
import { RAW_DATA_BLOCK_TYPES, ruleEntryForPlayer } from "./ruleForReader";

const fiche = {
  name: "Épée longue",
  blocks: [
    { blockType: "description", data: { segments: [] } },
    { blockType: "weapon", data: { damage: "1d10" }, originalData: { damage: "1d8" } },
    { blockType: "custom_table", data: { rows: [{ field: "index", value: "longsword" }] } },
    { blockType: "class_progression", data: { rows: [] } },
  ],
  modifiedBlockTypes: ["weapon"],
  houseVersion: false,
  isHomebrew: false,
  isOfficialBase: false,
};

describe("une règle telle qu'un joueur a le droit de la recevoir (V3.1-95, règle 5)", () => {
  it("ni données brutes, ni donnée d'avant la variante, ni marques du MJ", () => {
    const vue = ruleEntryForPlayer(fiche);
    expect(vue.blocks.map((b) => b.blockType)).toEqual(["description", "weapon"]);
    expect(vue.blocks.some((b) => "originalData" in b)).toBe(false);
    expect(vue.modifiedBlockTypes).toEqual([]);
    expect(vue.houseVersion).toBe(false);
    expect(JSON.stringify(vue)).not.toMatch(/1d8|longsword/);
  });

  it("« Règle de la table » : la règle diffère de l'officielle (variante ou version maison), sans dire en quoi", () => {
    expect(ruleEntryForPlayer(fiche).tableRule).toBe(true);
    expect(ruleEntryForPlayer({ ...fiche, modifiedBlockTypes: [], houseVersion: true }).tableRule).toBe(true);
    expect(ruleEntryForPlayer({ ...fiche, modifiedBlockTypes: [], houseVersion: false }).tableRule).toBe(false);
  });

  it("les types de données brutes", () => {
    expect([...RAW_DATA_BLOCK_TYPES].sort()).toEqual(["class_progression", "custom_table", "spellcasting_progression"]);
  });
});
