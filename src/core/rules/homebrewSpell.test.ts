import { describe, expect, it } from "vitest";
import { buildHomebrewSpellEntry, HomebrewSpellError, type HomebrewSpellInput } from "./homebrewSpell";
import { parseCustomTableFields, parseSpellClasses, parseSpellLevel, type CustomTableRow } from "./srdMapping";
import { resolveScaledFormulaText } from "./scaling";
import type { EffectsBlockData, ScalingBlockData } from "../schemas/rule-blocks/blocks";

const base: HomebrewSpellInput = {
  name: " Piqûre mentale ",
  level: 0,
  school: "Enchantment",
  castingTime: "1 action",
  range: "18 mètres",
  components: ["V"],
  material: "",
  duration: "Instantanée",
  concentration: false,
  ritual: false,
  description: "",
  pageRef: "",
  effect: null,
  scaling: [],
  classes: [
    { key: "wizard", name: "Magicien" },
    { key: "sorcerer", name: "Ensorceleur" },
  ],
};

function block(entry: ReturnType<typeof buildHomebrewSpellEntry>, type: string) {
  return entry.blocks.find((b) => b.block_type === type);
}

describe("buildHomebrewSpellEntry", () => {
  it("ecrit toujours spell_casting, avec les champs saisis", () => {
    const entry = buildHomebrewSpellEntry(base);
    expect(entry.name).toBe("Piqûre mentale");
    expect(entry.entry_type).toBe("spell");
    expect(block(entry, "spell_casting")?.data).toEqual({
      level: 0,
      school: "Enchantment",
      casting_time: "1 action",
      range: "18 mètres",
      components: ["V"],
      duration: "Instantanée",
      concentration: false,
      ritual: false,
    });
  });

  it("ne garde le texte du materiel que si M est coche", () => {
    const withoutM = buildHomebrewSpellEntry({ ...base, material: "une plume" });
    expect(block(withoutM, "spell_casting")?.data).not.toHaveProperty("material");
    const withM = buildHomebrewSpellEntry({ ...base, components: ["V", "S", "M"], material: " une plume " });
    expect(block(withM, "spell_casting")?.data).toMatchObject({ components: ["V", "S", "M"], material: "une plume" });
  });

  it("ecrit les classes et le niveau dans la forme brute que lit l'assistant de creation", () => {
    const table = block(buildHomebrewSpellEntry({ ...base, level: 3 }), "custom_table")?.data as { rows: CustomTableRow[] };
    const fields = parseCustomTableFields(table.rows);
    expect(parseSpellLevel(fields)).toBe(3);
    expect(parseSpellClasses(fields)).toEqual(["wizard", "sorcerer"]);
  });

  it("sans effet chiffre : aucun bloc effects ni scaling, comme les sorts utilitaires du SRD", () => {
    const entry = buildHomebrewSpellEntry({ ...base, scaling: [{ level: 5, formula: "2d6" }] });
    expect(block(entry, "effects")).toBeUndefined();
    expect(block(entry, "scaling")).toBeUndefined();
  });

  it("un effet a sauvegarde porte la caracteristique et l'effet en cas de reussite", () => {
    const entry = buildHomebrewSpellEntry({
      ...base,
      effect: { kind: "save", ability: "int", attackRange: "ranged", formula: "1d6", damageType: "psychic", onSuccess: "none" },
    });
    expect(block(entry, "effects")?.data).toEqual({
      effects: [{ id: "e1", damage_type: "psychic", formula: { op: "dice", count: 1, faces: 6 }, save: { ability: "int", effect_on_success: "none" } }],
    });
  });

  it("un effet a jet d'attaque porte la portee, jamais de sauvegarde", () => {
    const entry = buildHomebrewSpellEntry({
      ...base,
      effect: { kind: "attack", ability: "dex", attackRange: "ranged", formula: "1d10", damageType: "fire", onSuccess: "half" },
    });
    expect(block(entry, "effects")?.data).toEqual({
      effects: [{ id: "e1", damage_type: "fire", formula: { op: "dice", count: 1, faces: 10 }, attack: { range: "ranged" } }],
    });
  });

  it("refuse une formule de degats illisible, avec un message", () => {
    expect(() =>
      buildHomebrewSpellEntry({ ...base, effect: { kind: "none", ability: "dex", attackRange: "ranged", formula: "beaucoup", damageType: "fire", onSuccess: "half" } })
    ).toThrow(HomebrewSpellError);
  });

  it("tour de magie : la montee en puissance suit le niveau de personnage, palier de base compris", () => {
    const entry = buildHomebrewSpellEntry({
      ...base,
      effect: { kind: "save", ability: "int", attackRange: "ranged", formula: "1d6", damageType: "psychic", onSuccess: "none" },
      scaling: [
        { level: 11, formula: "3d6" },
        { level: 5, formula: " 2d6 " },
      ],
    });
    expect(block(entry, "scaling")?.data).toEqual({ axis: "character_level", base: 1, rule: null, table: { "1": "1d6", "5": "2d6", "11": "3d6" } });
  });

  it("sort a emplacement : la montee en puissance suit le niveau d'emplacement", () => {
    const entry = buildHomebrewSpellEntry({
      ...base,
      level: 3,
      effect: { kind: "save", ability: "dex", attackRange: "ranged", formula: "8d6", damageType: "fire", onSuccess: "half" },
      scaling: [{ level: 4, formula: "9d6" }],
    });
    expect(block(entry, "scaling")?.data).toEqual({ axis: "slot_level", base: 3, rule: null, table: { "3": "8d6", "4": "9d6" } });
  });

  it("la montee en puissance ecrite est celle que le moteur relit au lancement", () => {
    const entry = buildHomebrewSpellEntry({
      ...base,
      level: 3,
      effect: { kind: "save", ability: "dex", attackRange: "ranged", formula: "8d6", damageType: "fire", onSuccess: "half" },
      scaling: [{ level: 4, formula: "9d6" }],
    });
    const effects = block(entry, "effects")?.data as EffectsBlockData;
    const scaling = block(entry, "scaling")?.data as ScalingBlockData;
    expect(resolveScaledFormulaText(scaling, 4, effects, effects.effects[0].formula!)).toBe("9d6");
  });

  it("refuse un palier sous le palier de base, ou une formule de palier illisible", () => {
    const effect = { kind: "save" as const, ability: "dex", attackRange: "ranged" as const, formula: "8d6", damageType: "fire", onSuccess: "half" as const };
    expect(() => buildHomebrewSpellEntry({ ...base, level: 3, effect, scaling: [{ level: 2, formula: "7d6" }] })).toThrow(HomebrewSpellError);
    expect(() => buildHomebrewSpellEntry({ ...base, level: 3, effect, scaling: [{ level: 4, formula: "plus" }] })).toThrow(HomebrewSpellError);
  });

  it("description : omise si vide, page seule acceptee", () => {
    expect(block(buildHomebrewSpellEntry(base), "description")).toBeUndefined();
    expect(block(buildHomebrewSpellEntry({ ...base, pageRef: "MdJ 2024, p. 297" }), "description")?.data).toEqual({ segments: [], page_ref: "MdJ 2024, p. 297" });
  });
});
