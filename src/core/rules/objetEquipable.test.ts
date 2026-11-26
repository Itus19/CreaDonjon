import { describe, expect, it } from "vitest";
import { DEFAULT_EQUIPPABLE_BLOCK_DATA, type EquippableBlockData } from "../schemas/blocks/equippable";
import { effetsDeLObjet } from "./objetEquipable";
import { characterSheet, type CharacterBuild, type EquippedItem, type ResolvedRuleset } from "./sheet";

const collier: EquippableBlockData = {
  ...DEFAULT_EQUIPPABLE_BLOCK_DATA,
  modifiers: [{ target: "ac", op: "add", value: 1 }],
  spells: [{ key: "misty-step", ability: "cha", free_cast: { uses: 1, refresh: "long_rest" } }],
  actions: [{ id: "eclair", name: "Éclair", charges: 3, recharge: "dawn" }],
};
const item = (equipped: boolean, attuned = false) => ({ id: "i1", label: "Collier des marées", equipped, attuned });

describe("un artéfact équipable (AG-19, ADR 0107)", () => {
  it("équipé : ses modificateurs en couche 6, son sort et le compteur de son action", () => {
    const e = effetsDeLObjet(item(true), collier);
    expect(e.equipped).toBe(true);
    expect(e.modifiers).toEqual([{ target: "ac", op: "add", value: 1, source: "item:i1", label: "Collier des marées", layer: 6 }]);
    expect(e.spells).toEqual([{ key: "misty-step", atLevel: 0, ability: "cha", alwaysPrepared: true, freeCast: { uses: 1, refresh: "long_rest" } }]);
    expect(e.resources).toEqual([{ key: "item.i1.eclair", label: { fr: "Éclair" }, max: { op: "num", value: 3 }, recharge: "dawn" }]);
  });

  it("« seulement équipé » : dans le sac, rien ne compte ; décoché, il agit dès qu'on le porte", () => {
    expect(effetsDeLObjet(item(false), collier).equipped).toBe(false);
    expect(effetsDeLObjet(item(false), { ...collier, only_equipped: false }).equipped).toBe(true);
  });

  it("« harmonisation requise » : rien ne compte sans le lien, même équipé", () => {
    const lie = { ...collier, requires_attunement: true };
    const sheetSans = fiche([effetsDeLObjet(item(true, false), lie)]);
    const sheetAvec = fiche([effetsDeLObjet(item(true, true), lie)]);
    expect(sheetAvec.ac.value - sheetSans.ac.value).toBe(1);
    expect(sheetSans.grantedSpells).toEqual([]);
    expect(sheetAvec.grantedSpells.map((s) => s.key)).toEqual(["misty-step"]);
    expect(sheetSans.resources.some((r) => r.key === "item.i1.eclair")).toBe(false);
    expect(sheetAvec.resources.find((r) => r.key === "item.i1.eclair")?.max).toBe(3);
  });

  it("le sort accordé se lance avec la caractéristique de l'objet", () => {
    const s = fiche([effetsDeLObjet(item(true), collier)]).grantedSpells[0];
    expect(s).toMatchObject({ key: "misty-step", featureKey: "item:i1", label: "Collier des marées", ability: "cha", alwaysPrepared: true });
    expect(s.saveDc).toBe(8 + 2 + 0);
  });
});

const BUILD: CharacterBuild = {
  species: "",
  classes: [{ key: "fighter", level: 1 }],
  abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  featureKeys: [],
};
const RULESET: ResolvedRuleset = { classes: { fighter: { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: [] } }, features: {} } as unknown as ResolvedRuleset;

function fiche(equipment: EquippedItem[]) {
  return characterSheet(BUILD, RULESET, equipment, []);
}
