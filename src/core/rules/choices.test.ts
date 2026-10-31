import { describe, expect, it } from "vitest";
import { resolveChoices, type ChoiceSource, type FeatChoiceData } from "./choices";
import { characterSheet, type CharacterBuild, type ResolvedRuleset } from "./sheet";
import { zChoicesBlockData, type ChoiceGrant } from "../schemas/rule-blocks/choices";

/** Les choix tels que `data/srd/choices-2024.json` les saisit, réduits à ce que chaque test lit. */
const MAGIC_INITIATE_GRANTS: ChoiceGrant[] = [
  {
    id: "list",
    label: { fr: "Liste de sorts" },
    from: {
      kind: "option",
      options: (["cleric", "druid", "wizard"] as const).map((list) => ({
        id: list,
        label: { fr: list },
        grants: [
          { id: "cantrips", label: { fr: "Sorts mineurs" }, count: 2, from: { kind: "spell", list, level: 0 } },
          {
            id: "spell",
            label: { fr: "Sort de niveau 1" },
            from: { kind: "spell", list, level: 1, always_prepared: true, free_cast: { uses: 1, refresh: "long_rest" } },
          },
        ],
      })),
    },
  },
  { id: "ability", label: { fr: "Caractéristique d'incantation" }, from: { kind: "ability", options: ["int", "wis", "cha"], spellcasting: true } },
];

const LINEAGE_FREE_CAST = { uses: 1, refresh: "long_rest" } as const;
const ELVEN_LINEAGE_GRANTS: ChoiceGrant[] = [
  {
    id: "lineage",
    label: { fr: "Lignage elfique" },
    from: {
      kind: "option",
      options: [
        {
          id: "drow",
          label: { fr: "Drow" },
          spells: [
            { key: "dancing-lights" },
            { key: "faerie-fire", at_level: 3, always_prepared: true, free_cast: LINEAGE_FREE_CAST },
            { key: "darkness", at_level: 5, always_prepared: true, free_cast: LINEAGE_FREE_CAST },
          ],
        },
        {
          id: "wood-elf",
          label: { fr: "Elfe sylvestre" },
          modifiers: [{ target: "speed", op: "add", value: 5 }],
          spells: [{ key: "druidcraft" }],
        },
      ],
    },
  },
  { id: "ability", label: { fr: "Caractéristique d'incantation" }, from: { kind: "ability", options: ["int", "wis", "cha"], spellcasting: true } },
];

const SKILLED: FeatChoiceData = {
  key: "skilled",
  label: "Doué",
  category: "origin",
  modifiers: [],
  grants: [{ id: "proficiencies", label: { fr: "Compétences ou outils" }, count: 3, from: { kind: "skill", tools: true } }],
};
const ALERT: FeatChoiceData = { key: "alert", label: "Vigilant", category: "origin", modifiers: [{ target: "initiative", op: "add", value: 2 }], grants: [] };
const ARCHERY: FeatChoiceData = { key: "archery", label: "Archerie", category: "fighting-style", modifiers: [], grants: [] };
const MAGIC_INITIATE: FeatChoiceData = { key: "magic-initiate", label: "Initié à la magie", category: "origin", modifiers: [], grants: MAGIC_INITIATE_GRANTS };

const SPELLS = {
  guidance: { level: 0, lists: ["cleric", "druid"] },
  "sacred-flame": { level: 0, lists: ["cleric"] },
  bless: { level: 1, lists: ["cleric", "paladin"] },
  "magic-missile": { level: 1, lists: ["sorcerer", "wizard"] },
};

const versatile: ChoiceSource = {
  key: "versatile",
  label: "Polyvalent",
  layer: 2,
  grants: [{ id: "feat", label: { fr: "Don d'origine" }, from: { kind: "feat", category: "origin" } }],
};

function sheetAt(level: number, features: ReturnType<typeof resolveChoices>["features"]) {
  const ruleset: ResolvedRuleset = {
    classes: { wizard: { key: "wizard", label: "Magicien", hitDie: 6, savingThrowProficiencies: [] } },
    features: Object.fromEntries(features.map((f) => [f.key, f])),
  };
  const build: CharacterBuild = {
    species: "elf",
    classes: [{ key: "wizard", level }],
    abilities: { assigned: { str: 10, dex: 10, con: 10, int: 16, wis: 12, cha: 14 } },
    featureKeys: features.map((f) => f.key),
  };
  return characterSheet(build, ruleset, [], []);
}

describe("le bloc choices", () => {
  it("valide les choix saisis pour Initié à la magie et le lignage elfique", () => {
    expect(zChoicesBlockData.safeParse({ grants: MAGIC_INITIATE_GRANTS }).success).toBe(true);
    expect(zChoicesBlockData.safeParse({ grants: ELVEN_LINEAGE_GRANTS }).success).toBe(true);
  });
  it("refuse deux choix au même identifiant (la clé stockée serait ambiguë)", () => {
    const dup = { grants: [MAGIC_INITIATE_GRANTS[1], MAGIC_INITIATE_GRANTS[1]] };
    expect(zChoicesBlockData.safeParse(dup).success).toBe(false);
  });
  it("refuse un genre de choix inconnu", () => {
    const bad = { grants: [{ id: "x", label: { fr: "x" }, from: { kind: "wish" } }] };
    expect(zChoicesBlockData.safeParse(bad).success).toBe(false);
  });
});

describe("Initié à la magie (V3.1-116, critère 1)", () => {
  const source: ChoiceSource = { key: "magic-initiate", label: "Initié à la magie", layer: 5, grants: MAGIC_INITIATE_GRANTS };

  it("sans réponse : la liste et la caractéristique sont à choisir, pas encore les sorts", () => {
    const r = resolveChoices({ sources: [source], choices: {}, characterLevel: 1 });
    expect(r.open.map((c) => c.key)).toEqual(["magic-initiate.list", "magic-initiate.ability"]);
    expect(r.features).toEqual([]);
  });

  it("la liste choisie ouvre ses sorts ; les sorts choisis deviennent des sorts de la fiche", () => {
    const choices = {
      "magic-initiate.list": ["cleric"],
      "magic-initiate.list.cleric.cantrips": ["guidance", "sacred-flame"],
      "magic-initiate.list.cleric.spell": ["bless"],
      "magic-initiate.ability": ["wis"],
    };
    const r = resolveChoices({ sources: [source], choices, characterLevel: 1, spells: SPELLS });
    expect(r.open.map((c) => c.key)).toEqual([
      "magic-initiate.list",
      "magic-initiate.list.cleric.cantrips",
      "magic-initiate.list.cleric.spell",
      "magic-initiate.ability",
    ]);
    const sheet = sheetAt(1, r.features);
    expect(sheet.grantedSpells.map((s) => [s.key, s.ability])).toEqual([
      ["guidance", "wis"],
      ["sacred-flame", "wis"],
      ["bless", "wis"],
    ]);
    const bless = sheet.grantedSpells.find((s) => s.key === "bless")!;
    expect(bless.alwaysPrepared).toBe(true);
    expect(bless.freeCast).toEqual({ uses: 1, refresh: "long_rest" });
    // 8 + maîtrise 2 + Sagesse +1
    expect(bless.saveDc).toBe(11);
    expect(bless.attackBonus).toBe(3);
  });

  it("un sort hors de la liste ou du niveau est écarté quand le catalogue des sorts est connu", () => {
    const choices = {
      "magic-initiate.list": ["cleric"],
      "magic-initiate.list.cleric.cantrips": ["guidance", "bless"],
      "magic-initiate.list.cleric.spell": ["magic-missile"],
      "magic-initiate.ability": ["wis"],
    };
    const r = resolveChoices({ sources: [source], choices, characterLevel: 1, spells: SPELLS });
    expect(sheetAt(1, r.features).grantedSpells.map((s) => s.key)).toEqual(["guidance"]);
  });

  it("une liste imposée (historique Acolyte) compte comme choisie et le reste", () => {
    const r = resolveChoices({
      sources: [source],
      choices: { "magic-initiate.list": ["wizard"] },
      presets: { "magic-initiate.list": ["cleric"] },
      characterLevel: 1,
    });
    const list = r.open.find((c) => c.key === "magic-initiate.list")!;
    expect(list.chosen).toEqual(["cleric"]);
    expect(list.preset).toBe(true);
    expect(r.open.some((c) => c.key === "magic-initiate.list.cleric.cantrips")).toBe(true);
  });
});

describe("Lignage elfique Drow (V3.1-116, critère 2)", () => {
  const source: ChoiceSource = { key: "elven-lineage", label: "Lignage elfique", layer: 2, grants: ELVEN_LINEAGE_GRANTS };
  const choices = { "elven-lineage.lineage": ["drow"], "elven-lineage.ability": ["cha"] };

  it("niveau 1 : le sort mineur ; niveau 3 : Lueurs féeriques ; niveau 5 : Ténèbres", () => {
    const r = resolveChoices({ sources: [source], choices, characterLevel: 1 });
    expect(sheetAt(1, r.features).grantedSpells.map((s) => s.key)).toEqual(["dancing-lights"]);
    expect(sheetAt(3, r.features).grantedSpells.map((s) => s.key)).toEqual(["dancing-lights", "faerie-fire"]);
    expect(sheetAt(5, r.features).grantedSpells.map((s) => s.key)).toEqual(["dancing-lights", "faerie-fire", "darkness"]);
  });

  it("la caractéristique d'incantation est choisie une fois et sert à tous les sorts du lignage", () => {
    const r = resolveChoices({ sources: [source], choices, characterLevel: 5 });
    const spells = sheetAt(5, r.features).grantedSpells;
    expect(spells.every((s) => s.ability === "cha")).toBe(true);
    // 8 + maîtrise 3 + Charisme +2
    expect(spells[0].saveDc).toBe(13);
  });

  it("sans caractéristique choisie, les sorts sont là mais sans DD", () => {
    const r = resolveChoices({ sources: [source], choices: { "elven-lineage.lineage": ["drow"] }, characterLevel: 1 });
    const [spell] = sheetAt(1, r.features).grantedSpells;
    expect(spell.ability).toBeUndefined();
    expect(spell.saveDc).toBeUndefined();
  });

  it("l'option choisie porte ses modificateurs : l'elfe sylvestre gagne 1,5 m de vitesse", () => {
    const r = resolveChoices({ sources: [source], choices: { "elven-lineage.lineage": ["wood-elf"] }, characterLevel: 1 });
    expect(sheetAt(1, r.features).speed.value).toBe(35);
  });

  it("une option inconnue ne produit rien", () => {
    const r = resolveChoices({ sources: [source], choices: { "elven-lineage.lineage": ["deep-gnome"] }, characterLevel: 1 });
    expect(r.features).toEqual([]);
    expect(r.open.find((c) => c.key === "elven-lineage.lineage")!.chosen).toEqual([]);
  });
});

describe("Polyvalent : un don au choix, et sa cascade", () => {
  const feats = { skilled: SKILLED, alert: ALERT, archery: ARCHERY, "magic-initiate": MAGIC_INITIATE };

  it("le don choisi ouvre ses propres choix, sous une clé qui le nomme", () => {
    const r = resolveChoices({ sources: [versatile], choices: { "versatile.feat": ["skilled"] }, characterLevel: 1, feats });
    expect(r.open.map((c) => c.key)).toEqual(["versatile.feat", "versatile.feat.skilled.proficiencies"]);
    // Le don choisi figure parmi les traits, même sans effet chiffré.
    expect(r.features.map((f) => f.label)).toEqual(["Doué"]);
  });

  it("Doué : les compétences choisies sont maîtrisées, l'outil va aux maîtrises", () => {
    const r = resolveChoices({
      sources: [versatile],
      choices: { "versatile.feat": ["skilled"], "versatile.feat.skilled.proficiencies": ["stealth", "animal-handling", "thieves-tools"] },
      characterLevel: 1,
      feats,
    });
    const sheet = sheetAt(1, r.features);
    expect(sheet.skills.stealth.proficiency).toBe("proficient");
    expect(sheet.skills.animal_handling.proficiency).toBe("proficient");
    expect(r.tools).toEqual([{ key: "thieves-tools", source: "Doué" }]);
  });

  it("le don choisi porte ses modificateurs", () => {
    const r = resolveChoices({ sources: [versatile], choices: { "versatile.feat": ["alert"] }, characterLevel: 1, feats });
    expect(r.features.map((f) => f.label)).toEqual(["Vigilant"]);
    expect(r.features[0].modifiers[0]).toMatchObject({ target: "initiative", value: 2, layer: 5 });
  });

  it("un don d'une autre catégorie, ou inconnu, est écarté", () => {
    for (const feat of ["archery", "wish"]) {
      const r = resolveChoices({ sources: [versatile], choices: { "versatile.feat": [feat] }, characterLevel: 1, feats });
      expect(r.features).toEqual([]);
      expect(r.open).toHaveLength(1);
    }
  });

  it("Initié à la magie choisi par Polyvalent : la cascade complète", () => {
    const r = resolveChoices({
      sources: [versatile],
      choices: {
        "versatile.feat": ["magic-initiate"],
        "versatile.feat.magic-initiate.list": ["cleric"],
        "versatile.feat.magic-initiate.list.cleric.spell": ["bless"],
        "versatile.feat.magic-initiate.ability": ["int"],
      },
      characterLevel: 1,
      feats,
      spells: SPELLS,
    });
    expect(sheetAt(1, r.features).grantedSpells).toEqual([expect.objectContaining({ key: "bless", ability: "int" })]);
  });
});

describe("ce que la résolution n'invente pas", () => {
  it("une fiche sans choix n'ajoute rien à faire (V3.1-116, critère 3)", () => {
    const r = resolveChoices({ sources: [{ key: "darkvision", label: "Vision dans le noir", layer: 2, grants: [] }], choices: {}, characterLevel: 1 });
    expect(r).toEqual({ open: [], features: [], tools: [], languages: [], proficientSkills: [] });
  });

  it("un choix ouvert à un niveau plus haut n'apparaît pas avant", () => {
    const grants: ChoiceGrant[] = [{ id: "late", label: { fr: "Plus tard" }, at_level: 3, from: { kind: "skill" } }];
    const source: ChoiceSource = { key: "x", label: "X", layer: 3, grants };
    expect(resolveChoices({ sources: [source], choices: {}, characterLevel: 2 }).open).toEqual([]);
    expect(resolveChoices({ sources: [source], choices: {}, characterLevel: 3 }).open).toHaveLength(1);
  });

  it("garde au plus `count` valeurs, sans doublon, et écarte une compétence hors des options", () => {
    const grants: ChoiceGrant[] = [{ id: "skills", label: { fr: "Sens aiguisés" }, from: { kind: "skill", options: ["insight", "perception", "survival"] } }];
    const source: ChoiceSource = { key: "keen-senses", label: "Sens aiguisés", layer: 2, grants };
    const r = resolveChoices({ sources: [source], choices: { "keen-senses.skills": ["arcana", "perception", "perception", "survival"] }, characterLevel: 1 });
    expect(r.open[0].chosen).toEqual(["perception"]);
    expect(r.features[0].modifiers.map((m) => m.target)).toEqual(["skill.perception"]);
  });

  it("une réponse qui n'est pas un tableau de textes compte comme absente", () => {
    const grants: ChoiceGrant[] = [{ id: "skills", label: { fr: "Compétent" }, from: { kind: "skill" } }];
    const r = resolveChoices({ sources: [{ key: "skillful", label: "Compétent", layer: 2, grants }], choices: { "skillful.skills": "stealth" }, characterLevel: 1 });
    expect(r.open[0].chosen).toEqual([]);
  });

  it("les langues choisies sont rendues avec leur source", () => {
    const grants: ChoiceGrant[] = [{ id: "languages", label: { fr: "Langues" }, count: 2, from: { kind: "language" } }];
    const r = resolveChoices({ sources: [{ key: "bg", label: "Sage", layer: 4, grants }], choices: { "bg.languages": ["elvish", "dwarvish"] }, characterLevel: 1 });
    expect(r.languages).toEqual([
      { key: "elvish", source: "Sage" },
      { key: "dwarvish", source: "Sage" },
    ]);
  });
});

describe("le pont vers les écrans existants", () => {
  it("Compétent et Sens aiguisés gardent leur clé et leurs options", async () => {
    const { simpleGrantChoices } = await import("./choices");
    const sources: ChoiceSource[] = [
      { key: "skillful", label: "Compétent", layer: 2, grants: [{ id: "skills", label: { fr: "Compétent" }, from: { kind: "skill" } }] },
      { key: "keen-senses", label: "Sens aiguisés", layer: 2, grants: [{ id: "skills", label: { fr: "Sens aiguisés" }, from: { kind: "skill", options: ["insight", "animal-handling"] } }] },
      { key: "versatile", label: "Polyvalent", layer: 2, grants: [{ id: "feat", label: { fr: "Don" }, from: { kind: "feat" } }] },
    ];
    const views = simpleGrantChoices(sources, 1, ["elvish"]);
    expect(views.map((v) => v.id)).toEqual(["skillful.skills", "keen-senses.skills"]);
    expect(views[0].options).toHaveLength(18);
    expect(views[1].options).toEqual(["insight", "animal_handling"]);
  });
});

describe("Expertise : un choix parmi les compétences déjà maîtrisées (V3.1-49)", () => {
  const EXPERTISE: ChoiceSource = {
    key: "rogue-expertise",
    label: "Expertise",
    layer: 3,
    origin: "class",
    classKey: "rogue",
    grants: [
      { id: "skills", label: { fr: "Expertise" }, count: 2, from: { kind: "skill", expertise: true } },
      { id: "skills-6", label: { fr: "Expertise (niveau 6)" }, count: 2, at_level: 6, from: { kind: "skill", expertise: true } },
    ],
  };
  const maitrise = (skill: string) => ({
    key: `p:${skill}`,
    label: "Roublard",
    source: "class:rogue",
    modifiers: [{ target: `skill.${skill}`, op: "proficiency" as const, layer: 3 as const, source: "class:rogue", label: "Roublard" }],
  });

  it("le bloc accepte le drapeau `expertise`", () => {
    expect(zChoicesBlockData.parse({ grants: EXPERTISE.grants }).grants[0].from).toEqual({ kind: "skill", expertise: true });
  });

  it("sans compétence maîtrisée, rien n'est retenu : l'expertise attend les compétences", () => {
    const r = resolveChoices({ sources: [EXPERTISE], choices: { "rogue-expertise.skills": ["stealth", "perception"] }, characterLevel: 1, classLevels: { rogue: 1 }, otherFeatures: [] });
    expect(r.open.find((c) => c.key === "rogue-expertise.skills")?.chosen).toEqual([]);
    expect(r.proficientSkills).toEqual([]);
    expect(r.features.flatMap((f) => f.modifiers)).toEqual([]);
  });

  it("une compétence maîtrisée ailleurs est retenue et devient une expertise ; une autre est écartée", () => {
    const r = resolveChoices({
      sources: [EXPERTISE],
      choices: { "rogue-expertise.skills": ["stealth", "perception"] },
      characterLevel: 1,
      classLevels: { rogue: 1 },
      otherFeatures: [maitrise("stealth")],
    });
    expect(r.open.find((c) => c.key === "rogue-expertise.skills")?.chosen).toEqual(["stealth"]);
    expect(r.proficientSkills).toEqual(["stealth"]);
    expect(r.features.flatMap((f) => f.modifiers)).toEqual([expect.objectContaining({ target: "skill.stealth", op: "expertise" })]);
  });

  it("une compétence maîtrisée par un AUTRE choix compte, quel que soit l'ordre des fiches", () => {
    const competent: ChoiceSource = { key: "skillful", label: "Compétent", layer: 2, origin: "species", grants: [{ id: "skills", label: { fr: "Compétent" }, from: { kind: "skill" } }] };
    const r = resolveChoices({
      sources: [EXPERTISE, competent],
      choices: { "rogue-expertise.skills": ["insight"], "skillful.skills": ["insight"] },
      characterLevel: 1,
      classLevels: { rogue: 1 },
      otherFeatures: [],
    });
    expect(r.open.find((c) => c.key === "rogue-expertise.skills")?.chosen).toEqual(["insight"]);
  });

  it("le second choix n'apparaît qu'au niveau 6 de roublard", () => {
    const r1 = resolveChoices({ sources: [EXPERTISE], choices: {}, characterLevel: 6, classLevels: { rogue: 5 }, otherFeatures: [] });
    expect(r1.open.map((c) => c.key)).toEqual(["rogue-expertise.skills"]);
    const r6 = resolveChoices({ sources: [EXPERTISE], choices: {}, characterLevel: 6, classLevels: { rogue: 6 }, otherFeatures: [] });
    expect(r6.open.map((c) => c.key)).toEqual(["rogue-expertise.skills", "rogue-expertise.skills-6"]);
  });

  it("sans `otherFeatures` (appelant qui ne les connaît pas), l'expertise est prise telle quelle", () => {
    const r = resolveChoices({ sources: [EXPERTISE], choices: { "rogue-expertise.skills": ["stealth"] }, characterLevel: 1, classLevels: { rogue: 1 } });
    expect(r.open.find((c) => c.key === "rogue-expertise.skills")?.chosen).toEqual(["stealth"]);
  });
});

describe("le niveau et la classe d'un choix ouvert (V3.1-51)", () => {
  it("un choix porte le niveau qui l'ouvre et la classe de sa fiche ; un choix imbriqué hérite de son parent", () => {
    const expertise: ChoiceSource = {
      key: "rogue-expertise",
      label: "Expertise",
      layer: 3,
      origin: "class",
      classKey: "rogue",
      grants: [
        { id: "skills", label: { fr: "Expertise" }, count: 2, from: { kind: "skill", expertise: true } },
        { id: "skills-6", label: { fr: "Expertise (6)" }, count: 2, at_level: 6, from: { kind: "skill", expertise: true } },
      ],
    };
    const lignage: ChoiceSource = { key: "elven-lineage", label: "Lignage", layer: 2, origin: "species", grants: ELVEN_LINEAGE_GRANTS };
    const r = resolveChoices({ sources: [expertise, lignage], choices: {}, characterLevel: 6, classLevels: { rogue: 6 } });
    expect(r.open.map((c) => [c.key, c.atLevel, c.classKey ?? null])).toEqual([
      ["rogue-expertise.skills", 1, "rogue"],
      ["rogue-expertise.skills-6", 6, "rogue"],
      ["elven-lineage.lineage", 1, null],
      ["elven-lineage.ability", 1, null],
    ]);
  });
});
