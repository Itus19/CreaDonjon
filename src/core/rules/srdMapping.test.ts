import { describe, expect, it } from "vitest";
import {
  armorAcModifier,
  extractFeatureKeysUpToLevel,
  extractSkillChoices,
  extractSlotsByLevel,
  mapBackgroundModifiers,
  mapChosenSkillModifiers,
  mapClassCore,
  mapClassSpellcastingAbility,
  mapSpeciesModifiers,
  parseArmorData,
  parseCustomTableFields,
  parseItemWeight,
  parseSpellLevel,
  parseWeaponData,
} from "./srdMapping";

// Fixtures fideles a la forme reelle des donnees SRD deja importees
// (verifie contre la base reelle avant d'ecrire ce fichier).
const DWARF_ROWS = [
  { field: "index", value: "dwarf" },
  { field: "speed", value: "25" },
  {
    field: "ability_bonuses",
    value: JSON.stringify([{ ability_score: { index: "con", name: "CON" }, bonus: 2 }]),
  },
];

const FIGHTER_ROWS = [
  { field: "index", value: "fighter" },
  { field: "hit_die", value: "10" },
  {
    field: "saving_throws",
    value: JSON.stringify([{ index: "str", name: "STR" }, { index: "con", name: "CON" }]),
  },
  {
    field: "proficiency_choices",
    value: JSON.stringify([
      {
        desc: "Choose two skills",
        choose: 2,
        type: "proficiencies",
        from: {
          option_set_type: "options_array",
          options: [
            { option_type: "reference", item: { index: "skill-athletics" } },
            { option_type: "reference", item: { index: "skill-intimidation" } },
            { option_type: "reference", item: { index: "skill-animal-handling" } },
          ],
        },
      },
    ]),
  },
];

const WIZARD_ROWS = [
  { field: "index", value: "wizard" },
  { field: "hit_die", value: "6" },
  {
    field: "saving_throws",
    value: JSON.stringify([{ index: "int" }, { index: "wis" }]),
  },
  {
    field: "spellcasting",
    value: JSON.stringify({ level: 1, spellcasting_ability: { index: "int", name: "INT" } }),
  },
];

const ACOLYTE_ROWS = [
  { field: "index", value: "acolyte" },
  {
    field: "starting_proficiencies",
    value: JSON.stringify([{ index: "skill-insight" }, { index: "skill-religion" }]),
  },
];

describe("parseCustomTableFields", () => {
  it("deserialise chaque valeur JSON quand c'est possible, garde le texte brut sinon", () => {
    const fields = parseCustomTableFields([
      { field: "speed", value: "25" },
      { field: "stealth_disadvantage", value: "true" },
      { field: "alignment", value: "Most dwarves are lawful." },
    ]);
    expect(fields.speed).toBe(25);
    expect(fields.stealth_disadvantage).toBe(true);
    expect(fields.alignment).toBe("Most dwarves are lawful.");
  });
});

describe("mapSpeciesModifiers", () => {
  it("mappe le bonus de caracteristique et la vitesse du nain (SRD 2014)", () => {
    const fields = parseCustomTableFields(DWARF_ROWS);
    const modifiers = mapSpeciesModifiers(fields, "species:dwarf", "Nain");
    expect(modifiers).toEqual([
      { target: "ability.con", op: "add", value: 2, layer: 2, source: "species:dwarf", label: "Nain" },
      { target: "speed", op: "set", value: 25, layer: 2, source: "species:dwarf", label: "Nain" },
    ]);
  });

  it("ne produit aucun modificateur de caracteristique si ability_bonuses est absent (SRD 2024)", () => {
    const fields = parseCustomTableFields([{ field: "speed", value: "30" }]);
    const modifiers = mapSpeciesModifiers(fields, "species:dwarf", "Nain");
    expect(modifiers).toEqual([{ target: "speed", op: "set", value: 30, layer: 2, source: "species:dwarf", label: "Nain" }]);
  });
});

describe("mapClassCore", () => {
  it("extrait le de de vie et les maitrises de jets de sauvegarde du guerrier", () => {
    const fields = parseCustomTableFields(FIGHTER_ROWS);
    expect(mapClassCore(fields)).toEqual({ hitDie: 10, savingThrowProficiencies: ["str", "con"] });
  });
});

describe("mapClassSpellcastingAbility", () => {
  it("trouve la caracteristique d'incantation du magicien", () => {
    const fields = parseCustomTableFields(WIZARD_ROWS);
    expect(mapClassSpellcastingAbility(fields)).toBe("int");
  });

  it("retourne null pour une classe non lanceuse de sorts", () => {
    const fields = parseCustomTableFields(FIGHTER_ROWS);
    expect(mapClassSpellcastingAbility(fields)).toBeNull();
  });
});

describe("extractSlotsByLevel / extractFeatureKeysUpToLevel", () => {
  const PROGRESSION_ROWS = [
    { level: 1, features: [{ feature: "wizard-arcane-recovery" }], spellcasting_spell_slots_level_1: 2, spellcasting_spell_slots_level_2: 0 },
    { level: 2, features: [{ feature: "wizard-scholar" }], spellcasting_spell_slots_level_1: 3, spellcasting_spell_slots_level_2: 0 },
    { level: 3, features: [], spellcasting_spell_slots_level_1: 4, spellcasting_spell_slots_level_2: 2 },
  ];

  it("extrait la table d'emplacements par niveau", () => {
    expect(extractSlotsByLevel(PROGRESSION_ROWS)).toEqual({
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
    });
  });

  it("cumule les cles de feature jusqu'au niveau donne", () => {
    expect(extractFeatureKeysUpToLevel(PROGRESSION_ROWS, 2)).toEqual(["wizard-arcane-recovery", "wizard-scholar"]);
  });
});

describe("extractSkillChoices / mapChosenSkillModifiers", () => {
  it("extrait le choix de competences du guerrier avec des cles en snake_case", () => {
    const fields = parseCustomTableFields(FIGHTER_ROWS);
    expect(extractSkillChoices(fields)).toEqual([
      { count: 2, options: ["athletics", "intimidation", "animal_handling"] },
    ]);
  });

  it("mappe des competences choisies en modificateurs de maitrise (couche 3)", () => {
    expect(mapChosenSkillModifiers(["athletics", "intimidation"], "class:fighter", "Guerrier")).toEqual([
      { target: "skill.athletics", op: "proficiency", layer: 3, source: "class:fighter", label: "Guerrier" },
      { target: "skill.intimidation", op: "proficiency", layer: 3, source: "class:fighter", label: "Guerrier" },
    ]);
  });
});

describe("mapBackgroundModifiers", () => {
  it("mappe les competences de l'acolyte (starting_proficiencies, SRD 2014)", () => {
    const fields = parseCustomTableFields(ACOLYTE_ROWS);
    expect(mapBackgroundModifiers(fields, "background:acolyte", "Acolyte")).toEqual([
      { target: "skill.insight", op: "proficiency", layer: 4, source: "background:acolyte", label: "Acolyte" },
      { target: "skill.religion", op: "proficiency", layer: 4, source: "background:acolyte", label: "Acolyte" },
    ]);
  });

  it("accepte aussi la cle `proficiencies` (SRD 2024)", () => {
    const fields = parseCustomTableFields([
      { field: "proficiencies", value: JSON.stringify([{ index: "skill-athletics" }]) },
    ]);
    expect(mapBackgroundModifiers(fields, "background:soldier", "Soldat")).toEqual([
      { target: "skill.athletics", op: "proficiency", layer: 4, source: "background:soldier", label: "Soldat" },
    ]);
  });
});

describe("parseArmorData / armorAcModifier", () => {
  it("armure lourde (cotte de mailles) : CA fixe, jamais de Dex", () => {
    const fields = parseCustomTableFields([
      { field: "armor_category", value: "Heavy" },
      { field: "armor_class", value: JSON.stringify({ base: 16, dex_bonus: false }) },
    ]);
    const armor = parseArmorData(fields)!;
    expect(armor).toEqual({ category: "Heavy", base: 16, dexBonus: false });
    expect(armorAcModifier(armor, 3, "item:i1", "Cotte de mailles")).toEqual({
      target: "ac",
      op: "set",
      value: 16,
      layer: 6,
      source: "item:i1",
      label: "Cotte de mailles",
    });
  });

  it("armure legere (cuir) : Dex complete", () => {
    const armor = { category: "Light", base: 11, dexBonus: true };
    expect(armorAcModifier(armor, 3, "item:i1", "Cuir")).toMatchObject({ op: "set", value: 14 });
  });

  it("armure medium : Dex plafonnee a +2", () => {
    const armor = { category: "Medium", base: 13, dexBonus: true };
    expect(armorAcModifier(armor, 4, "item:i1", "Demi-plate")).toMatchObject({ op: "set", value: 15 });
  });

  it("bouclier : s'ajoute, ne remplace rien", () => {
    const armor = { category: "Shield", base: 2, dexBonus: false };
    expect(armorAcModifier(armor, 3, "item:i1", "Bouclier")).toMatchObject({ op: "add", value: 2 });
  });

  it("retourne null si les champs d'armure sont absents", () => {
    expect(parseArmorData(parseCustomTableFields([{ field: "name", value: "Fiole de sable noir" }]))).toBeNull();
  });
});

// Fixtures fideles a la forme reelle des donnees SRD 2014 deja importees
// (verifiees contre data/srd/srd-2014.json avant d'ecrire ce fichier).
const SHORTSWORD_ROWS = [
  { field: "index", value: "shortsword" },
  { field: "weapon_category", value: "Martial" },
  { field: "weapon_range", value: "Melee" },
  {
    field: "damage",
    value: JSON.stringify({ damage_dice: "1d6", damage_type: { index: "piercing", name: "Piercing" } }),
  },
  { field: "range", value: JSON.stringify({ normal: 5 }) },
  {
    field: "properties",
    value: JSON.stringify([
      { index: "finesse", name: "Finesse" },
      { index: "light", name: "Light" },
      { index: "monk", name: "Monk" },
    ]),
  },
];

const LONGSWORD_ROWS = [
  { field: "index", value: "longsword" },
  { field: "weapon_category", value: "Martial" },
  { field: "weapon_range", value: "Melee" },
  {
    field: "damage",
    value: JSON.stringify({ damage_dice: "1d8", damage_type: { index: "slashing", name: "Slashing" } }),
  },
  {
    field: "two_handed_damage",
    value: JSON.stringify({ damage_dice: "1d10", damage_type: { index: "slashing", name: "Slashing" } }),
  },
  { field: "properties", value: JSON.stringify([{ index: "versatile", name: "Versatile" }]) },
];

const LONGBOW_ROWS = [
  { field: "index", value: "longbow" },
  { field: "weapon_category", value: "Martial" },
  { field: "weapon_range", value: "Ranged" },
  {
    field: "damage",
    value: JSON.stringify({ damage_dice: "1d8", damage_type: { index: "piercing", name: "Piercing" } }),
  },
  { field: "range", value: JSON.stringify({ normal: 150, long: 600 }) },
  {
    field: "properties",
    value: JSON.stringify([
      { index: "ammunition", name: "Ammunition" },
      { index: "heavy", name: "Heavy" },
      { index: "two-handed", name: "Two-Handed" },
    ]),
  },
];

// Forme SRD 2024 : `weapon_category`/`weapon_range` disparaissent au profit
// d'`equipment_categories`, une `mastery` apparait — damage/properties inchanges.
const SHORTSWORD_2024_ROWS = [
  { field: "index", value: "shortsword" },
  {
    field: "equipment_categories",
    value: JSON.stringify([{ index: "martial-melee-weapons", name: "Martial Melee Weapons" }]),
  },
  { field: "mastery", value: JSON.stringify({ index: "vex", name: "Vex" }) },
  {
    field: "damage",
    value: JSON.stringify({ damage_dice: "1d6", damage_type: { index: "piercing", name: "Piercing" } }),
  },
  { field: "properties", value: JSON.stringify([{ index: "finesse", name: "Finesse" }]) },
];

describe("parseWeaponData", () => {
  it("epee courte : degats, type, proprietes, corps a corps", () => {
    const fields = parseCustomTableFields(SHORTSWORD_ROWS);
    expect(parseWeaponData(fields)).toEqual({
      damageDice: "1d6",
      damageType: "piercing",
      versatileDamageDice: null,
      properties: ["finesse", "light", "monk"],
      isRanged: false,
    });
  });

  it("epee longue : versatile, degats a deux mains distincts", () => {
    const fields = parseCustomTableFields(LONGSWORD_ROWS);
    expect(parseWeaponData(fields)).toEqual({
      damageDice: "1d8",
      damageType: "slashing",
      versatileDamageDice: "1d10",
      properties: ["versatile"],
      isRanged: false,
    });
  });

  it("arc long : arme a distance", () => {
    const fields = parseCustomTableFields(LONGBOW_ROWS);
    const weapon = parseWeaponData(fields)!;
    expect(weapon.isRanged).toBe(true);
    expect(weapon.properties).toContain("ammunition");
  });

  it("tolere la forme SRD 2024 (equipment_categories au lieu de weapon_range)", () => {
    const fields = parseCustomTableFields(SHORTSWORD_2024_ROWS);
    expect(parseWeaponData(fields)).toEqual({
      damageDice: "1d6",
      damageType: "piercing",
      versatileDamageDice: null,
      properties: ["finesse"],
      isRanged: false,
    });
  });

  it("retourne null si les champs d'arme sont absents (ex. une armure)", () => {
    const fields = parseCustomTableFields([
      { field: "armor_category", value: "Heavy" },
      { field: "armor_class", value: JSON.stringify({ base: 16, dex_bonus: false }) },
    ]);
    expect(parseWeaponData(fields)).toBeNull();
  });
});

// Champ verifie contre data/srd/srd-2014.json et srd-2024.json : `weight` en
// livres, present et identique sur les armes, armures et objets d'equipement
// des deux editions (ex. dague : "weight": 1).
describe("parseItemWeight", () => {
  it("lit un poids en livres present sur une arme", () => {
    expect(parseItemWeight(parseCustomTableFields([{ field: "weight", value: "1" }]))).toBe(1);
  });

  it("lit un poids present sur une armure", () => {
    const fields = parseCustomTableFields([
      { field: "armor_category", value: "Heavy" },
      { field: "weight", value: "55" },
    ]);
    expect(parseItemWeight(fields)).toBe(55);
  });

  it("retourne null si le champ est absent (contenu maison sans poids renseigne)", () => {
    expect(parseItemWeight(parseCustomTableFields([{ field: "name", value: "Fiole de sable noir" }]))).toBeNull();
  });
});

// Champ verifie contre data/srd/srd-2014.json et srd-2024.json : `level`
// (0 = tour de magie, sinon 1-9), meme forme sur les deux editions.
describe("parseSpellLevel", () => {
  it("lit le niveau d'un sort (0 = tour de magie)", () => {
    expect(parseSpellLevel(parseCustomTableFields([{ field: "level", value: "0" }]))).toBe(0);
  });

  it("lit un niveau non nul", () => {
    expect(parseSpellLevel(parseCustomTableFields([{ field: "level", value: "3" }]))).toBe(3);
  });

  it("retourne null si le champ est absent", () => {
    expect(parseSpellLevel(parseCustomTableFields([{ field: "name", value: "Boule de feu" }]))).toBeNull();
  });
});
