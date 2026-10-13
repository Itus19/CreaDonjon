import { describe, expect, it } from "vitest";
import { subclassFeatures, type SubclassFeatureData } from "./subclass";
import { resolveChoices } from "./choices";
import { characterSheet, type CharacterBuild, type ResolvedFeature, type ResolvedRuleset } from "./sheet";

/** Extraits de `data/srd/subclasses-2024.json`, réduits à ce que chaque test lit. */
const CIRCLE_OF_THE_LAND: SubclassFeatureData[] = [
  {
    name: "Circle of the Land Spells",
    level: 3,
    grants: [
      {
        id: "land",
        label: { fr: "Terrain" },
        refresh: "long_rest",
        from: {
          kind: "option",
          options: [
            {
              id: "arid",
              label: { fr: "Aride" },
              spells: [
                { key: "blur", at_level: 3, always_prepared: true },
                { key: "fireball", at_level: 5, always_prepared: true },
                { key: "blight", at_level: 7, always_prepared: true },
              ],
            },
            { id: "polar", label: { fr: "Polaire" }, spells: [{ key: "fog-cloud", at_level: 3, always_prepared: true }] },
          ],
        },
      },
    ],
  },
  { name: "Land's Aid", level: 3 },
  { name: "Natural Recovery", level: 6 },
];

const ELEMENTAL_AFFINITY: SubclassFeatureData[] = [
  { name: "Draconic Resilience", level: 3, modifiers: [{ target: "hp.max", op: "add", value: 1, per_level: true }] },
  {
    name: "Elemental Affinity",
    level: 6,
    grants: [{ id: "damage-type", label: { fr: "Type de dégâts" }, from: { kind: "damage_type", options: ["acid", "cold", "fire", "lightning", "poison"] } }],
  },
];

function sheetFor(classKey: string, level: number, features: ResolvedFeature[]) {
  const ruleset: ResolvedRuleset = {
    classes: { [classKey]: { key: classKey, label: classKey, hitDie: 8, savingThrowProficiencies: [] } },
    features: Object.fromEntries(features.map((f) => [f.key, f])),
  };
  const build: CharacterBuild = {
    species: "human",
    classes: [{ key: classKey, level }],
    abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 } },
    featureKeys: features.map((f) => f.key),
  };
  return characterSheet(build, ruleset, [], []);
}

describe("les aptitudes de sous-classe (V3.1-117)", () => {
  const druid = { key: "circle-of-the-land", label: "Cercle de la Terre", classKey: "druid" };

  it("une aptitude n'existe qu'à partir de son niveau de classe", () => {
    expect(subclassFeatures({ ...druid, classLevel: 2 }, CIRCLE_OF_THE_LAND)).toEqual({ features: [], sources: [] });
    const at3 = subclassFeatures({ ...druid, classLevel: 3 }, CIRCLE_OF_THE_LAND);
    expect(at3.sources.map((s) => s.key)).toEqual(["circle-of-the-land.circle-of-the-land-spells"]);
  });

  it("une sous-classe purement descriptive ne change rien (critère 2)", () => {
    const descriptive: SubclassFeatureData[] = [
      { name: "Fast Hands", level: 3 },
      { name: "Second-Story Work", level: 3 },
    ];
    const r = subclassFeatures({ key: "thief", label: "Voleur", classKey: "rogue", classLevel: 3 }, descriptive);
    expect(r).toEqual({ features: [], sources: [] });
  });

  it("les modificateurs d'une aptitude atteinte s'appliquent, en couche de classe", () => {
    const r = subclassFeatures({ key: "draconic-sorcery", label: "Sorcellerie draconique", classKey: "sorcerer", classLevel: 3 }, ELEMENTAL_AFFINITY);
    expect(r.features).toHaveLength(1);
    expect(r.features[0]).toMatchObject({ label: "Sorcellerie draconique — Draconic Resilience", source: "class:sorcerer" });
    expect(r.features[0].modifiers[0]).toMatchObject({ target: "hp.max", layer: 3 });
  });

  it("Affinité élémentaire : le type de dégâts se choisit une fois, au niveau 6 de classe", () => {
    const at6 = subclassFeatures({ key: "draconic-sorcery", label: "Sorcellerie draconique", classKey: "sorcerer", classLevel: 6 }, ELEMENTAL_AFFINITY);
    const r = resolveChoices({
      sources: at6.sources,
      choices: { "draconic-sorcery.elemental-affinity.damage-type": ["fire"] },
      characterLevel: 6,
      classLevels: { sorcerer: 6 },
    });
    expect(r.open).toEqual([expect.objectContaining({ key: "draconic-sorcery.elemental-affinity.damage-type", chosen: ["fire"], refresh: "never" })]);
  });

  it("Cercle de la Terre : le terrain choisi donne ses sorts selon le niveau de DRUIDE, pas de personnage", () => {
    const at5 = subclassFeatures({ ...druid, classLevel: 5 }, CIRCLE_OF_THE_LAND);
    const r = resolveChoices({
      sources: at5.sources,
      choices: { "circle-of-the-land.circle-of-the-land-spells.land": ["arid"] },
      // Personnage niveau 8 (druide 5, guerrier 3) : seul le niveau de druide compte.
      characterLevel: 8,
      classLevels: { druid: 5, fighter: 3 },
    });
    expect(r.open[0].refresh).toBe("long_rest");
    const ruleset: ResolvedRuleset = {
      classes: {
        druid: { key: "druid", label: "Druide", hitDie: 8, savingThrowProficiencies: [] },
        fighter: { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: [] },
      },
      features: Object.fromEntries(r.features.map((f) => [f.key, f])),
    };
    const build: CharacterBuild = {
      species: "human",
      classes: [
        { key: "druid", level: 5 },
        { key: "fighter", level: 3 },
      ],
      abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 } },
      featureKeys: r.features.map((f) => f.key),
    };
    expect(characterSheet(build, ruleset, [], []).grantedSpells.map((s) => [s.key, s.alwaysPrepared])).toEqual([
      ["blur", true],
      ["fireball", true],
    ]);
  });

  it("les choix d'une sous-classe ne s'ouvrent pas sans niveau de classe connu", () => {
    const at3 = subclassFeatures({ ...druid, classLevel: 3 }, CIRCLE_OF_THE_LAND);
    expect(resolveChoices({ sources: at3.sources, choices: {}, characterLevel: 3 }).open).toEqual([]);
  });
});

describe("le choix de sort élargi (Découvertes magiques, Savant en évocation)", () => {
  const SPELLS = {
    "cure-wounds": { level: 1, lists: ["cleric", "druid"], school: "abjuration" },
    fireball: { level: 3, lists: ["wizard"], school: "evocation" },
    "magic-missile": { level: 1, lists: ["wizard"], school: "evocation" },
    shield: { level: 1, lists: ["wizard"], school: "abjuration" },
    "eldritch-blast": { level: 0, lists: ["warlock"], school: "evocation" },
  };

  it("plusieurs listes : un sort de l'une d'elles est retenu", () => {
    const r = resolveChoices({
      sources: [{ key: "lore", label: "Collège du savoir", layer: 3, grants: [{ id: "discoveries", label: { fr: "Découvertes" }, count: 2, from: { kind: "spell", lists: ["cleric", "druid", "wizard"], always_prepared: true } }] }],
      choices: { "lore.discoveries": ["cure-wounds", "eldritch-blast"] },
      characterLevel: 6,
      spells: SPELLS,
    });
    expect(r.open[0].chosen).toEqual(["cure-wounds"]);
  });

  it("école et niveau maximal : deux sorts d'évocation de niveau 2 au plus", () => {
    const r = resolveChoices({
      sources: [{ key: "evoker", label: "Évocateur", layer: 3, grants: [{ id: "savant", label: { fr: "Savant" }, count: 2, from: { kind: "spell", list: "wizard", max_level: 2, school: "evocation" } }] }],
      choices: { "evoker.savant": ["fireball", "shield", "magic-missile"] },
      characterLevel: 3,
      spells: SPELLS,
    });
    expect(r.open[0].chosen).toEqual(["magic-missile"]);
  });
});

describe("une aptitude de sous-classe sur la fiche", () => {
  it("Résilience draconique : +1 PV max par niveau, sorcier niveau 3", () => {
    const r = subclassFeatures({ key: "draconic-sorcery", label: "Sorcellerie draconique", classKey: "sorcerer", classLevel: 3 }, ELEMENTAL_AFFINITY);
    const without = sheetFor("sorcerer", 3, []);
    expect(sheetFor("sorcerer", 3, r.features).hitPoints.max).toBe(without.hitPoints.max + 3);
  });
});
