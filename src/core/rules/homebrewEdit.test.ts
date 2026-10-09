import { describe, expect, it } from "vitest";
import { buildHomebrewSpellEntry, type HomebrewSpellInput } from "./homebrewSpell";
import { buildHomebrewSubclassEntry } from "./homebrewSubclass";
import {
  backgroundFormValues,
  blockTypesToRemove,
  featureFormValues,
  spellFormValues,
  subclassFormValues,
  weaponFormValues,
} from "./homebrewEdit";

const asBlocks = (blocks: { block_type: string; data: unknown }[]) => blocks.map((b) => ({ blockType: b.block_type, data: b.data }));

describe("blockTypesToRemove (V3.1-2)", () => {
  it("rend les blocs presents avant et absents maintenant", () => {
    expect(blockTypesToRemove(["description", "spell_casting", "effects"], ["spell_casting"])).toEqual(["description", "effects"]);
  });

  it("ne rend rien quand tout est garde, ou quand un bloc s'ajoute", () => {
    expect(blockTypesToRemove(["spell_casting"], ["spell_casting", "effects"])).toEqual([]);
  });

  it("ne rend chaque type qu'une fois", () => {
    expect(blockTypesToRemove(["effects", "effects"], [])).toEqual(["effects"]);
  });
});

describe("spellFormValues (V3.1-2)", () => {
  const input: HomebrewSpellInput = {
    name: "Trait de braise",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "36 m",
    components: ["V", "S", "M"],
    material: "un charbon",
    duration: "Instantanée",
    concentration: false,
    ritual: false,
    description: "Une gerbe d'étincelles.",
    pageRef: "MdJ p. 12",
    effect: { kind: "save", ability: "dex", attackRange: "ranged", formula: "3d6", damageType: "fire", onSuccess: "half" },
    scaling: [{ level: 3, formula: "5d6" }],
    classes: [{ key: "wizard", name: "Magicien" }],
  };

  it("relit exactement ce que le formulaire avait ecrit", () => {
    const values = spellFormValues(asBlocks(buildHomebrewSpellEntry(input).blocks));
    expect(values).toEqual({
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "36 m",
      components: ["V", "S", "M"],
      material: "un charbon",
      duration: "Instantanée",
      concentration: false,
      ritual: false,
      description: "Une gerbe d'étincelles.",
      pageRef: "MdJ p. 12",
      effect: { kind: "save", ability: "dex", attackRange: "ranged", formula: "3d6", damageType: "fire", onSuccess: "half" },
      scaling: [{ level: 3, formula: "5d6" }],
      classKeys: ["wizard"],
    });
  });

  it("relit un sort sans effet chiffre ni description", () => {
    const values = spellFormValues(
      asBlocks(buildHomebrewSpellEntry({ ...input, description: "", pageRef: "", effect: null, scaling: [], material: "", components: ["V"] }).blocks)
    );
    expect(values.effect).toBeNull();
    expect(values.description).toBe("");
    expect(values.pageRef).toBe("");
    expect(values.scaling).toEqual([]);
    expect(values.material).toBe("");
  });

  it("relit une attaque de sort", () => {
    const values = spellFormValues(
      asBlocks(buildHomebrewSpellEntry({ ...input, effect: { ...input.effect!, kind: "attack", attackRange: "melee" }, scaling: [] }).blocks)
    );
    expect(values.effect).toMatchObject({ kind: "attack", attackRange: "melee", formula: "3d6" });
  });
});

describe("subclassFormValues (V3.1-2)", () => {
  it("relit description, page et aptitudes", () => {
    const entry = buildHomebrewSubclassEntry({
      name: "Serment de vengeance",
      parentClassKey: "paladin",
      description: "Un serment sombre.",
      pageRef: "",
      features: [
        { name: "Voeu d'inimitie", level: 3, description: "Avantage contre une cible." },
        { name: "Vengeur implacable", level: 7, description: "" },
      ],
    });
    expect(subclassFormValues(asBlocks(entry.blocks))).toEqual({
      description: "Un serment sombre.",
      pageRef: "",
      features: [
        { name: "Voeu d'inimitie", level: 3, description: "Avantage contre une cible." },
        { name: "Vengeur implacable", level: 7, description: "" },
      ],
    });
  });
});

describe("featureFormValues (V3.1-2)", () => {
  it("relit description, prerequis, modificateurs et declencheurs", () => {
    const trigger = { id: "t1", when: { event: "check_failed" }, then: [{ action: "narrate_hint", text: "Relance." }] };
    const values = featureFormValues(
      asBlocks([
        { block_type: "description", data: { segments: [{ text: "Tu as de la chance." }] } },
        { block_type: "prerequisites", data: { items: ["Niveau 4"] } },
        { block_type: "modifiers", data: { modifiers: [{ target: "ac", op: "add", value: 1 }, { target: "save.dex", op: "proficiency" }] } },
        { block_type: "triggers", data: { triggers: [trigger] } },
      ])
    );
    expect(values).toEqual({
      description: "Tu as de la chance.",
      prerequisites: ["Niveau 4"],
      modifiers: [
        { target: "ac", op: "add", value: "1" },
        { target: "save.dex", op: "proficiency", value: "1" },
      ],
      triggers: [trigger],
    });
  });

  it("rend des listes vides pour un don sans bloc optionnel", () => {
    expect(featureFormValues(asBlocks([{ block_type: "description", data: { segments: [{ text: "Simple." }] } }]))).toEqual({
      description: "Simple.",
      prerequisites: [],
      modifiers: [],
      triggers: [],
    });
  });
});

describe("backgroundFormValues (V3.1-2)", () => {
  it("relit caracteristiques, competences, outil, don et equipement", () => {
    const values = backgroundFormValues(
      asBlocks([
        { block_type: "description", data: { segments: [{ text: "Une vie de guide." }] } },
        {
          block_type: "background",
          data: {
            ability_scores: ["wis", "con", "str"],
            feat: { kind: "rule", key: "magic-initiate" },
            skill_proficiencies: ["survival", "nature"],
            tool_proficiency: "Outils de cartographe",
            equipment_options: [
              { label: "A", items: [{ ref: { kind: "rule", key: "quarterstaff" }, label: "Bâton", quantity: 1 }, { label: "Corde", quantity: 2 }], gold: { value: 3, unit: "gp" } },
              { label: "B", items: [], gold: { value: 50, unit: "gp" } },
            ],
          },
        },
      ])
    );
    expect(values).toEqual({
      description: "Une vie de guide.",
      abilityScores: ["wis", "con", "str"],
      skillProficiencies: ["survival", "nature"],
      toolProficiency: "Outils de cartographe",
      featKey: "magic-initiate",
      equipmentOptions: [
        { label: "A", items: [{ key: "quarterstaff", quantity: 1 }, { key: "Corde", quantity: 2 }], gold: "3" },
        { label: "B", items: [], gold: "50" },
      ],
    });
  });

  it("rend null sans bloc background lisible", () => {
    expect(backgroundFormValues(asBlocks([]))).toBeNull();
  });
});

describe("weaponFormValues (V3.1-2)", () => {
  it("relit une arme a distance polyvalente, avec poids et prix (unites du bloc)", () => {
    const values = weaponFormValues(
      asBlocks([
        { block_type: "description", data: { segments: [{ text: "Arc de frene." }] } },
        {
          block_type: "weapon",
          data: {
            category: "martial",
            is_ranged: true,
            damage: { dice: { op: "dice", count: 1, faces: 8 }, type: "piercing" },
            versatile_damage: { op: "dice", count: 1, faces: 10 },
            properties: [{ kind: "rule", key: "weapon-property-ammunition" }],
            mastery: { kind: "rule", key: "weapon-mastery-slow" },
            range: { normal: { value: 150, unit: "ft" }, long: { value: 600, unit: "ft" } },
            weight: { value: 2, unit: "lb" },
            cost: { value: 50, unit: "gp" },
          },
        },
      ])
    );
    expect(values).toEqual({
      description: "Arc de frene.",
      category: "martial",
      isRanged: true,
      diceCount: 1,
      diceFaces: 8,
      damageType: "piercing",
      versatile: { count: 1, faces: 10 },
      propertyKeys: ["weapon-property-ammunition"],
      masteryKey: "weapon-mastery-slow",
      rangeFt: { normal: 150, long: 600 },
      weightLb: 2,
      cost: { value: 50, unit: "gp" },
    });
  });

  it("rend null sans bloc weapon lisible", () => {
    expect(weaponFormValues(asBlocks([{ block_type: "weapon", data: { category: "exotic" } }]))).toBeNull();
  });
});
