import { describe, expect, it } from "vitest";
import {
  armorAcModifier,
  armorDataFromBlock,
  backgroundFeatKeyFromBlock,
  backgroundModifiersFromBlock,
  costFromQuantity,
  extractBackgroundAbilityScores,
  extractBackgroundFeat,
  extractFeatureKeysUpToLevel,
  extractAsiGrantedLevels,
  extractLanguageChoice,
  extractSkillChoices,
  extractSlotsByLevel,
  isAbilityScoreImprovementGrant,
  mapBackgroundModifiers,
  mapChosenSkillModifiers,
  mapClassCore,
  mapClassSpellcastingAbility,
  mapPrerequisites,
  mapSpeciesModifiers,
  extractLanguages,
  mapProficiencies,
  parseArmorData,
  parseCustomTableFields,
  parseItemCost,
  parseItemWeight,
  parseSpellClasses,
  parseSpellLevel,
  parseWeaponData,
  SRD_LANGUAGES,
  weaponDataFromBlock,
  weightFromQuantity,
} from "./srdMapping";
import type { ArmorBlockData, BackgroundBlockData, WeaponBlockData } from "../schemas/rule-blocks";

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

  it("ne garde que la tranche (niveau exclusif, niveau] quand fromLevelExclusive est fourni (V2-G1, montee de niveau)", () => {
    expect(extractFeatureKeysUpToLevel(PROGRESSION_ROWS, 3, 1)).toEqual(["wizard-scholar"]);
  });
});

describe("isAbilityScoreImprovementGrant / extractAsiGrantedLevels (V2-G1, montee de niveau)", () => {
  // Cles reelles du SRD 2024 (import verifie) : une cle par classe,
  // reutilisee a chaque niveau d'ASI de cette classe.
  const FIGHTER_PROGRESSION_ROWS = [
    { level: 1, features: [{ feature: "fighter-fighting-style" }] },
    { level: 4, features: [{ feature: "fighter-ability-score-improvement" }] },
    { level: 6, features: [{ feature: "fighter-ability-score-improvement" }] },
    { level: 8, features: [{ feature: "fighter-ability-score-improvement" }] },
  ];

  it("reconnait la cle prefixee par la classe (SRD 2024)", () => {
    expect(isAbilityScoreImprovementGrant("fighter-ability-score-improvement", "fighter")).toBe(true);
    expect(isAbilityScoreImprovementGrant("fighter-fighting-style", "fighter")).toBe(false);
  });

  it("reconnait la cle partagee sans prefixe (SRD 2014, feature dedupliquee entre classes)", () => {
    expect(isAbilityScoreImprovementGrant("ability-score-improvement", "wizard")).toBe(true);
  });

  it("liste tous les niveaux d'ASI d'une classe, y compris ses niveaux supplementaires", () => {
    expect(extractAsiGrantedLevels(FIGHTER_PROGRESSION_ROWS, "fighter")).toEqual([4, 6, 8]);
  });

  // Trou de donnees connu et accepte (V2-G1) : sous le SRD 2014, la
  // deduplication de scripts/ingest-srd.ts fusionne les ASI supplementaires
  // du Guerrier/Roublard (texte propre a leur classe) sous une cle sans
  // aucun marqueur ("ability-score-improvement-2"/"-3", ordre d'insertion
  // de la Map, pas un identifiant stable) — indetectable sans corriger
  // l'import ET reimporter les donnees deja en base. Volontairement non
  // couvert : ce test documente la limite plutot que de la cacher.
  it.todo("SRD 2014 : les ASI supplementaires du Guerrier/Roublard ne sont pas detectees (cle sans marqueur apres deduplication)");
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

// Fixture fidele a data/srd/srd-2014.json : Backgrounds.acolyte.language_options
// pointe vers TOUTE la categorie Languages (resource_list), jamais une liste
// fixee dans l'entree elle-meme, contrairement aux choix de competences.
const ACOLYTE_LANGUAGE_OPTIONS_ROWS = [
  {
    field: "language_options",
    value: JSON.stringify({
      choose: 2,
      type: "languages",
      from: { option_set_type: "resource_list", resource_list_url: "/api/2014/languages" },
    }),
  },
];

describe("SRD_LANGUAGES", () => {
  it("porte les 16 langues standard du SRD (identiques 2014/2024, verifie contre data/srd/*.json)", () => {
    expect(SRD_LANGUAGES).toHaveLength(16);
    expect(SRD_LANGUAGES).toContain("common");
    expect(SRD_LANGUAGES).toContain("undercommon");
  });
});

describe("extractLanguageChoice", () => {
  it("lit le nombre de langues au choix d'un historique (Acolyte : 2)", () => {
    const fields = parseCustomTableFields(ACOLYTE_LANGUAGE_OPTIONS_ROWS);
    expect(extractLanguageChoice(fields)).toEqual({ count: 2 });
  });

  it("retourne null si le champ est absent (historique sans langue au choix)", () => {
    expect(extractLanguageChoice(parseCustomTableFields(ACOLYTE_ROWS))).toBeNull();
  });

  it("retourne null si le champ existe mais n'est pas un choix de langues (garde-fou de forme)", () => {
    const fields = parseCustomTableFields([
      { field: "language_options", value: JSON.stringify({ choose: 2, type: "tools" }) },
    ]);
    expect(extractLanguageChoice(fields)).toBeNull();
  });
});

// Fixture fidele a data/srd/srd-2014.json : `Classes.fighter.proficiencies`
// melange armure/arme/bouclier ET jets de sauvegarde dans le meme tableau.
const FIGHTER_PROFICIENCIES_ROWS = [
  {
    field: "proficiencies",
    value: JSON.stringify([
      { index: "all-armor", name: "All armor" },
      { index: "shields", name: "Shields" },
      { index: "simple-weapons", name: "Simple Weapons" },
      { index: "martial-weapons", name: "Martial Weapons" },
      { index: "saving-throw-str", name: "Saving Throw: STR" },
      { index: "saving-throw-con", name: "Saving Throw: CON" },
    ]),
  },
];

describe("mapProficiencies", () => {
  it("retient les maitrises d'armure/arme, exclut les jets de sauvegarde (deja couverts par mapClassCore)", () => {
    const fields = parseCustomTableFields(FIGHTER_PROFICIENCIES_ROWS);
    expect(mapProficiencies(fields)).toEqual([
      { key: "all-armor", name: "All armor" },
      { key: "shields", name: "Shields" },
      { key: "simple-weapons", name: "Simple Weapons" },
      { key: "martial-weapons", name: "Martial Weapons" },
    ]);
  });

  it("exclut aussi les competences (deja couvertes par mapBackgroundModifiers/mapChosenSkillModifiers)", () => {
    const fields = parseCustomTableFields([
      { field: "starting_proficiencies", value: JSON.stringify([{ index: "skill-insight" }, { index: "thieves-tools" }]) },
    ]);
    expect(mapProficiencies(fields)).toEqual([{ key: "thieves-tools", name: "thieves-tools" }]);
  });

  it("retourne un tableau vide si le champ est absent", () => {
    expect(mapProficiencies(parseCustomTableFields([{ field: "name", value: "Sans maitrise" }]))).toEqual([]);
  });
});

describe("extractLanguages", () => {
  it("lit les langues d'une espece (nain : commun, nain)", () => {
    const fields = parseCustomTableFields([
      {
        field: "languages",
        value: JSON.stringify([
          { index: "common", name: "Common" },
          { index: "dwarvish", name: "Dwarvish" },
        ]),
      },
    ]);
    expect(extractLanguages(fields)).toEqual([
      { key: "common", name: "Common" },
      { key: "dwarvish", name: "Dwarvish" },
    ]);
  });

  it("retourne un tableau vide si le champ est absent", () => {
    expect(extractLanguages(parseCustomTableFields([{ field: "name", value: "Sans langue" }]))).toEqual([]);
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

  it("forme SRD 2024 (chain shirt) : categorie deduite de equipment_categories, faute de armor_category", () => {
    const fields = parseCustomTableFields([
      { field: "index", value: "chain-shirt" },
      {
        field: "equipment_categories",
        value: JSON.stringify([
          { index: "armor", name: "Armor" },
          { index: "medium-armor", name: "Medium Armor" },
        ]),
      },
      { field: "armor_class", value: JSON.stringify({ base: 13, dex_bonus: true, max_bonus: 2 }) },
    ]);
    expect(parseArmorData(fields)).toEqual({ category: "Medium", base: 13, dexBonus: true });
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
      masteryKey: null,
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
      masteryKey: null,
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
      masteryKey: "vex",
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

// V1-D4 : meme resultat que parseWeaponData/parseArmorData/parseItemWeight/
// parseItemCost, mais depuis le bloc dedie plutot que custom_table — chemin
// necessaire pour une fiche maison (aucun custom_table de secours).
describe("weaponDataFromBlock", () => {
  it("epee courte : meme resultat que parseWeaponData depuis le bloc dedie", () => {
    const data: WeaponBlockData = {
      category: "martial",
      is_ranged: false,
      damage: { dice: { op: "dice", count: 1, faces: 6 }, type: "piercing" },
      properties: [{ kind: "rule", key: "weapon-property-finesse" }, { kind: "rule", key: "weapon-property-light" }],
    };
    expect(weaponDataFromBlock(data)).toEqual({
      damageDice: "1d6",
      damageType: "piercing",
      versatileDamageDice: null,
      properties: ["finesse", "light"],
      isRanged: false,
      masteryKey: null,
    });
  });

  it("epee longue : versatile converti en notation de des", () => {
    const data: WeaponBlockData = {
      category: "martial",
      is_ranged: false,
      damage: { dice: { op: "dice", count: 1, faces: 8 }, type: "slashing" },
      versatile_damage: { op: "dice", count: 1, faces: 10 },
      properties: [{ kind: "rule", key: "weapon-property-versatile" }],
    };
    expect(weaponDataFromBlock(data)).toEqual({
      damageDice: "1d8",
      damageType: "slashing",
      versatileDamageDice: "1d10",
      properties: ["versatile"],
      isRanged: false,
      masteryKey: null,
    });
  });

  it("masse d'armes : botte d'arme SRD 2024 lue depuis data.mastery, prefixe retire", () => {
    const data: WeaponBlockData = {
      category: "simple",
      is_ranged: false,
      damage: { dice: { op: "dice", count: 1, faces: 6 }, type: "bludgeoning" },
      properties: [],
      mastery: { kind: "rule", key: "weapon-mastery-sap" },
    };
    expect(weaponDataFromBlock(data).masteryKey).toBe("sap");
  });
});

describe("armorDataFromBlock", () => {
  it("armure legere : categorie capitalisee comme resolveArmorCategory", () => {
    const data: ArmorBlockData = { category: "light", base_ac: 11, dex_bonus: true };
    expect(armorDataFromBlock(data)).toEqual({ category: "Light", base: 11, dexBonus: true });
  });

  it("bouclier : meme libelle que parseArmorData pour armorAcModifier", () => {
    const data: ArmorBlockData = { category: "shield", base_ac: 2, dex_bonus: false };
    expect(armorDataFromBlock(data)).toEqual({ category: "Shield", base: 2, dexBonus: false });
  });
});

describe("weightFromQuantity / costFromQuantity", () => {
  it("lit la valeur d'une Quantity de poids", () => {
    expect(weightFromQuantity({ value: 2, unit: "lb" })).toBe(2);
  });

  it("retourne null sans Quantity (champ optionnel absent du bloc)", () => {
    expect(weightFromQuantity(undefined)).toBeNull();
  });

  it("lit valeur+unite d'une Quantity de cout", () => {
    expect(costFromQuantity({ value: 10, unit: "gp" })).toEqual({ quantity: 10, unit: "gp" });
  });

  it("retourne null sans Quantity de cout", () => {
    expect(costFromQuantity(undefined)).toBeNull();
  });
});

// Champ verifie contre data/srd/srd-2014.json et srd-2024.json : `cost:
// {quantity, unit}`, meme forme sur armes/armures/objets, les deux editions
// (ex. dague : "cost": {"quantity": 2, "unit": "gp"}).
describe("parseItemCost", () => {
  it("lit un cout present sur une arme", () => {
    const fields = parseCustomTableFields([{ field: "cost", value: JSON.stringify({ quantity: 2, unit: "gp" }) }]);
    expect(parseItemCost(fields)).toEqual({ quantity: 2, unit: "gp" });
  });

  it("retourne null si le champ est absent (contenu maison sans cout renseigne)", () => {
    expect(parseItemCost(parseCustomTableFields([{ field: "name", value: "Fiole de sable noir" }]))).toBeNull();
  });

  it("retourne null si la forme est incomplete (quantite manquante)", () => {
    const fields = parseCustomTableFields([{ field: "cost", value: JSON.stringify({ unit: "gp" }) }]);
    expect(parseItemCost(fields)).toBeNull();
  });

  it("lit un cout en nombre nu (categorie Poisons, implicitement en po)", () => {
    const fields = parseCustomTableFields([{ field: "cost", value: "150" }]);
    expect(parseItemCost(fields)).toEqual({ quantity: 150, unit: "gp" });
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

// Fixture fidele a data\srd\srd-2024.json : Spells.aura-of-life.classes
// (tableau de references {index, name, url}), meme forme sur les deux
// editions — sert a filtrer la liste de sorts par classe a la creation.
describe("parseSpellClasses", () => {
  it("lit les classes qui peuvent apprendre un sort", () => {
    const fields = parseCustomTableFields([
      { field: "classes", value: JSON.stringify([{ index: "cleric", name: "Cleric" }, { index: "paladin", name: "Paladin" }]) },
    ]);
    expect(parseSpellClasses(fields)).toEqual(["cleric", "paladin"]);
  });

  it("retourne un tableau vide si le champ est absent", () => {
    expect(parseSpellClasses(parseCustomTableFields([{ field: "level", value: "1" }]))).toEqual([]);
  });
});

// Fixture fidele a data/srd/srd-2024.json : Backgrounds.acolyte.feat —
// verifie present sur les 4 historiques 2024 importes, toujours une entree
// unique (jamais un choix). Absent du SRD 2014 (aucun champ equivalent).
describe("extractBackgroundFeat", () => {
  it("lit le don accorde par un historique (Acolyte -> Magic Initiate, SRD 2024)", () => {
    const fields = parseCustomTableFields([
      {
        field: "feat",
        value: JSON.stringify({ index: "magic-initiate", name: "Magic Initiate", note: "Cleric" }),
      },
    ]);
    expect(extractBackgroundFeat(fields)).toBe("magic-initiate");
  });

  it("retourne null si le champ est absent (historique SRD 2014, aucun champ equivalent)", () => {
    expect(extractBackgroundFeat(parseCustomTableFields(ACOLYTE_ROWS))).toBeNull();
  });
});

// Fixture fidele a Backgrounds.soldier.ability_scores de data/srd/srd-2024.json.
describe("extractBackgroundAbilityScores", () => {
  it("lit les trois caracteristiques d'un historique (Soldat -> FOR/DEX/CON, SRD 2024)", () => {
    const fields = parseCustomTableFields([
      {
        field: "ability_scores",
        value: JSON.stringify([
          { index: "str", name: "STR" },
          { index: "dex", name: "DEX" },
          { index: "con", name: "CON" },
        ]),
      },
    ]);
    expect(extractBackgroundAbilityScores(fields)).toEqual(["str", "dex", "con"]);
  });

  it("retourne un tableau vide si le champ est absent (historique SRD 2014, aucun champ equivalent)", () => {
    expect(extractBackgroundAbilityScores(parseCustomTableFields(ACOLYTE_ROWS))).toEqual([]);
  });

  it("ignore une entree dont l'index n'est pas une vraie caracteristique, sans faire echouer le reste", () => {
    const fields = parseCustomTableFields([
      { field: "ability_scores", value: JSON.stringify([{ index: "str" }, { index: "pas-une-carac" }, { index: "con" }]) },
    ]);
    expect(extractBackgroundAbilityScores(fields)).toEqual(["str", "con"]);
  });
});

describe("backgroundModifiersFromBlock / backgroundFeatKeyFromBlock (historique maison, bloc dedie)", () => {
  const data: BackgroundBlockData = {
    ability_scores: ["str", "dex", "con"],
    feat: { kind: "rule", key: "robuste-maison" },
    skill_proficiencies: ["athletics", "survival"],
    equipment_options: [{ label: "A", items: [{ label: "Corde", quantity: 1 }] }],
  };

  it("traduit skill_proficiencies en modificateurs de maitrise, couche 4", () => {
    expect(backgroundModifiersFromBlock(data, "background:test", "Historique de test")).toEqual([
      { target: "skill.athletics", op: "proficiency", layer: 4, source: "background:test", label: "Historique de test" },
      { target: "skill.survival", op: "proficiency", layer: 4, source: "background:test", label: "Historique de test" },
    ]);
  });

  it("lit la cle du don accorde depuis feat.key", () => {
    expect(backgroundFeatKeyFromBlock(data)).toBe("robuste-maison");
  });

  it("retourne null si feat ne reference pas une regle (kind different de 'rule')", () => {
    expect(backgroundFeatKeyFromBlock({ ...data, feat: { kind: "entity", key: "x" } })).toBeNull();
  });
});

// Fixture fidele a data/srd/srd-2014.json : Feats.grappler.prerequisites.
describe("mapPrerequisites", () => {
  it("lit un prerequis de caracteristique (Grappler : FOR >= 13)", () => {
    const sourceRaw = {
      prerequisites: [{ ability_score: { index: "str", name: "STR" }, minimum_score: 13 }],
    };
    expect(mapPrerequisites(sourceRaw)).toEqual([{ kind: "ability", ability: "str", min: 13 }]);
  });

  it("retourne un tableau vide si le champ est absent (la plupart des dons d'origine 2024 n'ont pas de prerequis)", () => {
    expect(mapPrerequisites({ index: "alert", name: "Alert" })).toEqual([]);
  });

  it("retourne un tableau vide si source_raw n'est pas un objet", () => {
    expect(mapPrerequisites(null)).toEqual([]);
    expect(mapPrerequisites(undefined)).toEqual([]);
  });
});
