import { describe, expect, it } from "vitest";
import {
  averageHitDie,
  characterSheet,
  layerForFeatureSource,
  resolveDeclaredModifiers,
  resolveHpGain,
  type ActiveEffect,
  type CharacterBuild,
  type EquippedItem,
  type ResolvedRuleset,
} from "./sheet";
import type { Rng } from "../dice/rng";

// Classes reutilisees par plusieurs cas.
const FIGHTER = {
  key: "fighter",
  label: "Guerrier",
  hitDie: 10,
  savingThrowProficiencies: ["str", "con"] as const,
};
const ROGUE = { key: "rogue", label: "Roublard", hitDie: 8, savingThrowProficiencies: ["dex", "int"] as const };
const WIZARD = {
  key: "wizard",
  label: "Magicien",
  hitDie: 6,
  savingThrowProficiencies: ["int", "wis"] as const,
  spellcasting: {
    ability: "int" as const,
    slotsByLevel: { 1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 } },
  },
};

describe("characterSheet — cas dores (specs/wiki-liens-et-personnages.md §B7)", () => {
  it("guerrier nain niveau 1, cotte de mailles + bouclier : couches 1 a 6, empilement de CA", () => {
    const build: CharacterBuild = {
      species: "dwarf",
      classes: [{ key: "fighter", level: 1 }],
      abilities: { assigned: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
      featureKeys: ["dwarf_traits", "fighter_skill_athletics"],
    };
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        dwarf_traits: {
          key: "dwarf_traits",
          label: "Traits nains",
          source: "species:dwarf",
          modifiers: [
            { target: "ability.con", op: "add", value: 2, layer: 2, source: "species:dwarf", label: "Espece : nain" },
            { target: "speed", op: "set", value: 25, layer: 2, source: "species:dwarf", label: "Espece : nain" },
          ],
        },
        fighter_skill_athletics: {
          key: "fighter_skill_athletics",
          label: "Competences de guerrier",
          source: "class:fighter",
          modifiers: [
            { target: "skill.athletics", op: "proficiency", layer: 3, source: "class:fighter", label: "Guerrier" },
          ],
        },
      },
    };
    const equipment: EquippedItem[] = [
      {
        key: "chain_mail",
        label: "Cotte de mailles",
        equipped: true,
        modifiers: [
          { target: "ac", op: "set", value: 16, layer: 6, source: "item:chain_mail", label: "Cotte de mailles" },
        ],
      },
      {
        key: "shield",
        label: "Bouclier",
        equipped: true,
        modifiers: [{ target: "ac", op: "add", value: 2, layer: 6, source: "item:shield", label: "Bouclier" }],
      },
    ];

    const sheet = characterSheet(build, ruleset, equipment, []);

    expect(sheet.abilities.con).toEqual({ score: 14, mod: 2, sources: expect.any(Array) });
    expect(sheet.proficiencyBonus).toBe(2);
    expect(sheet.ac.value).toBe(18);
    expect(sheet.ac.sources).toEqual([
      { label: "Cotte de mailles", value: 16 },
      { label: "Bouclier", value: 2 },
    ]);
    expect(sheet.savingThrows.str).toMatchObject({ mod: 5, proficient: true });
    expect(sheet.savingThrows.con).toMatchObject({ mod: 4, proficient: true });
    expect(sheet.savingThrows.dex).toMatchObject({ mod: 0, proficient: false });
    expect(sheet.skills.athletics).toMatchObject({ mod: 5, proficiency: "proficient" });
    expect(sheet.hitPoints.max).toBe(12);
    expect(sheet.hitPoints.hitDice).toBe("1d10");
    expect(sheet.speed.value).toBe(25);
    expect(sheet.warnings.filter((w) => w.kind === "unmet_prerequisite")).toEqual([]);
  });

  it("un modificateur couche 5 (ASI, V2-G1) s'empile sur un modificateur couche 2 (espece) sur la meme caracteristique", () => {
    // Non-regression : confirme que resolveTargetStack ordonne deja
    // correctement les couches, sans aucun changement dans sheet.ts —
    // une amelioration de caracteristique choisie a la montee de niveau
    // devient une ResolvedFeature synthetique de plus (meme mecanisme que
    // dwarf_traits ci-dessus), jamais un chemin special.
    const build: CharacterBuild = {
      species: "dwarf",
      classes: [{ key: "fighter", level: 4 }],
      abilities: { assigned: { str: 16, dex: 10, con: 12, int: 8, wis: 13, cha: 10 } },
      featureKeys: ["dwarf_traits", "fighter_asi_l4"],
    };
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        dwarf_traits: {
          key: "dwarf_traits",
          label: "Traits nains",
          source: "species:dwarf",
          modifiers: [
            { target: "ability.con", op: "add", value: 2, layer: 2, source: "species:dwarf", label: "Espece : nain" },
          ],
        },
        fighter_asi_l4: {
          key: "fighter_asi_l4",
          label: "ASI (Guerrier niv. 4)",
          source: "asi:fighter.l4",
          modifiers: [
            { target: "ability.con", op: "add", value: 1, layer: 5, source: "asi:fighter.l4", label: "ASI (Guerrier niv. 4)" },
          ],
        },
      },
    };

    const sheet = characterSheet(build, ruleset, [], []);

    // 12 (assignee) + 2 (espece, couche 2) + 1 (ASI, couche 5) = 15
    expect(sheet.abilities.con.score).toBe(15);
    expect(sheet.abilities.con.sources).toEqual([
      { label: "Valeur attribuée", value: 12 },
      { label: "Espece : nain", value: 2 },
      { label: "ASI (Guerrier niv. 4)", value: 1 },
    ]);
  });

  it("roublard niveau 5 avec expertise : maitrise, expertise, bonus de maitrise", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "rogue", level: 5 }],
      abilities: { assigned: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 13 } },
      featureKeys: ["rogue_stealth_expertise", "rogue_deception_proficiency"],
    };
    const ruleset: ResolvedRuleset = {
      classes: { rogue: ROGUE },
      features: {
        rogue_stealth_expertise: {
          key: "rogue_stealth_expertise",
          label: "Expertise (Discretion)",
          source: "class:rogue",
          modifiers: [
            { target: "skill.stealth", op: "expertise", layer: 3, source: "class:rogue", label: "Roublard" },
          ],
        },
        rogue_deception_proficiency: {
          key: "rogue_deception_proficiency",
          label: "Maitrise (Tromperie)",
          source: "class:rogue",
          modifiers: [
            { target: "skill.deception", op: "proficiency", layer: 3, source: "class:rogue", label: "Roublard" },
          ],
        },
      },
    };

    const sheet = characterSheet(build, ruleset, [], []);

    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.skills.stealth).toMatchObject({ mod: 9, proficiency: "expertise" });
    expect(sheet.skills.deception).toMatchObject({ mod: 4, proficiency: "proficient" });
    expect(sheet.skills.perception).toMatchObject({ mod: 1, proficiency: "none" });
    expect(sheet.savingThrows.dex).toMatchObject({ mod: 6, proficient: true });
    expect(sheet.savingThrows.int).toMatchObject({ mod: 3, proficient: true });
    expect(sheet.hitPoints.max).toBe(38);
    expect(sheet.hitPoints.hitDice).toBe("5d8");
  });

  it("magicien niveau 3 : DD de sort, emplacements, caracteristique d'incantation", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "wizard", level: 3 }],
      abilities: { assigned: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 } },
      featureKeys: [],
    };
    const ruleset: ResolvedRuleset = { classes: { wizard: WIZARD }, features: {} };

    const sheet = characterSheet(build, ruleset, [], []);

    expect(sheet.spellcasting).toEqual({
      ability: "int",
      saveDc: 13,
      attackBonus: 5,
      slots: { 1: 4, 2: 2 },
    });
    expect(sheet.hitPoints.max).toBe(17);
    expect(sheet.hitPoints.hitDice).toBe("3d6");
    expect(sheet.ac.value).toBe(12); // 10 + mod Dex (2), aucune armure
  });

  it("guerrier 5 / roublard 2 : multiclassage, seule la premiere classe donne les jets de sauvegarde", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [
        { key: "fighter", level: 5 },
        { key: "rogue", level: 2 },
      ],
      abilities: { assigned: { str: 16, dex: 13, con: 14, int: 10, wis: 8, cha: 10 } },
      featureKeys: [],
      // Cles qualifiees par origine (§B2) : deux classes proposant chacune un
      // "c1" ne s'ecrasent pas car prefixees par la classe qui les pose.
      choices: {
        "fighter.l1.c1": ["athletics", "survival"],
        "rogue.l1.c1": ["stealth", "perception"],
      },
    };
    const ruleset: ResolvedRuleset = { classes: { fighter: FIGHTER, rogue: ROGUE }, features: {} };

    const sheet = characterSheet(build, ruleset, [], []);

    expect(Object.keys(build.choices!)).toHaveLength(2);
    expect(sheet.proficiencyBonus).toBe(3); // niveau total 7 : 2 + floor(6/4)
    // Seule la classe de depart (guerrier) donne des maitrises de sauvegarde.
    expect(sheet.savingThrows.str).toMatchObject({ mod: 6, proficient: true });
    expect(sheet.savingThrows.con).toMatchObject({ mod: 5, proficient: true });
    expect(sheet.savingThrows.dex).toMatchObject({ mod: 1, proficient: false });
    expect(sheet.savingThrows.int).toMatchObject({ mod: 0, proficient: false });
    expect(sheet.hitPoints.hitDice).toBe("5d10 + 2d8");
    expect(sheet.hitPoints.max).toBe(58);
  });

  it("guerrier niveau 3, PV jetes aux niveaux 2 et 3 (V2-G1) : les valeurs enregistrees remplacent la moyenne", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "fighter", level: 3, hpRolls: [10, 3] }],
      abilities: { assigned: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 } },
      featureKeys: [],
    };
    const ruleset: ResolvedRuleset = { classes: { fighter: FIGHTER }, features: {} };

    const sheet = characterSheet(build, ruleset, [], []);

    // Niveau 1 (max, 10) + jet niveau 2 (10) + jet niveau 3 (3) + Con (+1 * 3).
    expect(sheet.hitPoints.max).toBe(10 + 10 + 3 + 3);
  });

  it("guerrier niveau 3, un seul PV jete sur deux (V2-G1) : le niveau restant retombe sur la moyenne, comme avant cette fonctionnalite", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "fighter", level: 3, hpRolls: [10] }],
      abilities: { assigned: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 } },
      featureKeys: [],
    };
    const ruleset: ResolvedRuleset = { classes: { fighter: FIGHTER }, features: {} };

    const sheet = characterSheet(build, ruleset, [], []);

    // Niveau 1 (max, 10) + jet niveau 2 (10) + moyenne niveau 3 (6) + Con (+1 * 3).
    expect(sheet.hitPoints.max).toBe(10 + 10 + averageHitDie(10) + 3);
  });

  it("magicien 3 / roublard 2 (multiclassage) : les PV jetes de la SECONDE classe couvrent aussi son propre premier niveau (jamais exempte, seule la toute premiere classe l'est)", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [
        { key: "wizard", level: 3 },
        { key: "rogue", level: 2, hpRolls: [7, 2] },
      ],
      abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      featureKeys: [],
    };
    const ruleset: ResolvedRuleset = { classes: { wizard: WIZARD, rogue: ROGUE }, features: {} };

    const sheet = characterSheet(build, ruleset, [], []);

    // Magicien : niveau 1 (max, 6) + 2 niveaux a la moyenne (4 chacun).
    // Roublard : deux jets explicites (7 + 2), aucune exemption (pas la premiere classe).
    expect(sheet.hitPoints.max).toBe(6 + 4 + 4 + 7 + 2);
  });

  it("resolveHpGain (V2-G1) : moyenne 5e sans RNG, jet reel via le RNG injecte", () => {
    const fixedRoll: Rng = { nextInt: () => 4 }; // rollDice fait +1 : jet = 5
    expect(resolveHpGain("average", 10, fixedRoll)).toBe(averageHitDie(10));
    expect(resolveHpGain("rolled", 10, fixedRoll)).toBe(5);
  });

  it("sous benediction et entrave : couche 7, avantage et desavantage s'annulent", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "fighter", level: 1 }],
      abilities: { assigned: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
      featureKeys: [],
    };
    const ruleset: ResolvedRuleset = { classes: { fighter: FIGHTER }, features: {} };
    const activeEffects: ActiveEffect[] = [
      {
        key: "bless",
        label: "Benediction",
        modifiers: [
          { target: "save.dex", op: "advantage", layer: 7, source: "effect:bless", label: "Benediction" },
          { target: "skill.perception", op: "advantage", layer: 7, source: "effect:bless", label: "Benediction" },
        ],
      },
      {
        key: "restrained",
        label: "Entrave",
        modifiers: [
          { target: "save.dex", op: "disadvantage", layer: 7, source: "effect:restrained", label: "Entrave" },
        ],
      },
    ];

    const sheet = characterSheet(build, ruleset, [], activeEffects);

    // Meme cible touchee par les deux effets : avantage et desavantage s'annulent.
    expect(sheet.savingThrows.dex.rollState).toBe("normal");
    // Cible touchee par un seul effet : l'avantage seul persiste.
    expect(sheet.skills.perception.rollState).toBe("advantage");
    // Cible non touchee : aucun effet.
    expect(sheet.savingThrows.str.rollState).toBe("normal");
  });

  it("prerequis non satisfait : avertissement present, enregistrement autorise", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "fighter", level: 1 }],
      abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      featureKeys: ["grappler_feat"],
    };
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        grappler_feat: {
          key: "grappler_feat",
          label: "Don : Lutteur",
          source: "feat:grappler",
          modifiers: [],
          prerequisites: [{ kind: "ability", ability: "str", min: 13 }],
        },
      },
    };

    const sheet = characterSheet(build, ruleset, [], []);

    // Le personnage illegal reste enregistrable : le don reste dans la liste.
    expect(sheet.features.map((f) => f.key)).toContain("grappler_feat");
    expect(sheet.warnings.filter((w) => w.kind === "unmet_prerequisite")).toEqual([
      {
        kind: "unmet_prerequisite",
        featureKey: "grappler_feat",
        message: 'Prerequis non satisfait pour "Don : Lutteur" : Force >= 13',
      },
    ]);
  });
});

describe("characterSheet — regles d'empilement (§B4)", () => {
  const baseBuild = (featureKeys: string[]): CharacterBuild => ({
    species: "human",
    classes: [{ key: "fighter", level: 1 }],
    abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    featureKeys,
  });

  it("stacking 'stack' (defaut) : tous les modificateurs s'additionnent", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        a: { key: "a", label: "A", source: "x", modifiers: [{ target: "ac", op: "add", value: 1, layer: 6, source: "a", label: "A" }] },
        b: { key: "b", label: "B", source: "x", modifiers: [{ target: "ac", op: "add", value: 1, layer: 6, source: "b", label: "B" }] },
      },
    };
    const sheet = characterSheet(baseBuild(["a", "b"]), ruleset, [], []);
    expect(sheet.ac.value).toBe(12); // 10 (base) + 1 + 1
  });

  it("stacking 'highest' : seul le plus fort compte", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        a: {
          key: "a",
          label: "A",
          source: "x",
          modifiers: [{ target: "ac", op: "add", value: 1, layer: 6, source: "a", label: "A", stacking: "highest" }],
        },
        b: {
          key: "b",
          label: "B",
          source: "x",
          modifiers: [{ target: "ac", op: "add", value: 3, layer: 6, source: "b", label: "B", stacking: "highest" }],
        },
      },
    };
    const sheet = characterSheet(baseBuild(["a", "b"]), ruleset, [], []);
    expect(sheet.ac.value).toBe(13); // 10 (base) + 3 (le plus fort), pas +1+3
  });

  it("stacking 'unique' : une seule source compte, meme avec plusieurs modificateurs", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        a: {
          key: "a",
          label: "A",
          source: "x",
          modifiers: [{ target: "ac", op: "add", value: 1, layer: 6, source: "a", label: "A", stacking: "unique" }],
        },
        b: {
          key: "b",
          label: "B",
          source: "x",
          modifiers: [{ target: "ac", op: "add", value: 1, layer: 6, source: "b", label: "B", stacking: "unique" }],
        },
      },
    };
    const sheet = characterSheet(baseBuild(["a", "b"]), ruleset, [], []);
    expect(sheet.ac.value).toBe(11); // 10 (base) + 1 seulement
  });

  it("'set' ecrase tout ce qui precede sur la cible, meme apres un 'add' anterieur", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        early: {
          key: "early",
          label: "Precoce",
          source: "x",
          modifiers: [{ target: "ac", op: "add", value: 5, layer: 2, source: "early", label: "Precoce" }],
        },
        armor: {
          key: "armor",
          label: "Armure",
          source: "x",
          modifiers: [{ target: "ac", op: "set", value: 16, layer: 6, source: "armor", label: "Armure" }],
        },
      },
    };
    const sheet = characterSheet(baseBuild(["early", "armor"]), ruleset, [], []);
    expect(sheet.ac.value).toBe(16);
    expect(sheet.ac.sources).toEqual([{ label: "Armure", value: 16 }]);
  });

  it("'min' et 'max' s'appliquent en dernier, comme bornes", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        floor: {
          key: "floor",
          label: "Plancher",
          source: "x",
          modifiers: [{ target: "speed", op: "min", value: 20, layer: 7, source: "floor", label: "Plancher" }],
        },
        cap: {
          key: "cap",
          label: "Plafond",
          source: "x",
          modifiers: [{ target: "speed", op: "max", value: 25, layer: 7, source: "cap", label: "Plafond" }],
        },
      },
    };
    const sheet = characterSheet(baseBuild(["floor", "cap"]), ruleset, [], []);
    expect(sheet.speed.value).toBe(25); // base 30, plafonnee a 25
  });

  it("prerequis de niveau et de fonctionnalite requise (§B5), satisfaits et non satisfaits", () => {
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        vet_trait: { key: "vet_trait", label: "Trait veteran", source: "x", modifiers: [], prerequisites: [{ kind: "level", min: 1 }] },
        needs_self: {
          key: "needs_self",
          label: "Necessite le trait veteran",
          source: "x",
          modifiers: [],
          prerequisites: [{ kind: "has_feature", key: "vet_trait" }],
        },
        needs_ally_and_level: {
          key: "needs_ally_and_level",
          label: "Necessite un allie et le niveau 10",
          source: "x",
          modifiers: [],
          prerequisites: [
            { kind: "level", min: 10 },
            { kind: "has_feature", key: "nonexistent" },
          ],
        },
      },
    };
    const build = baseBuild(["vet_trait", "needs_self", "needs_ally_and_level"]);

    const sheet = characterSheet(build, ruleset, [], []);

    const prerequis = sheet.warnings.filter((w) => w.kind === "unmet_prerequisite");
    expect(prerequis).toHaveLength(2);
    expect(prerequis.every((w) => w.featureKey === "needs_ally_and_level")).toBe(true);
    expect(prerequis.map((w) => w.message)).toEqual([
      'Prerequis non satisfait pour "Necessite un allie et le niveau 10" : Niveau >= 10',
      'Prerequis non satisfait pour "Necessite un allie et le niveau 10" : Possede "nonexistent"',
    ]);
  });

  it("la fonction n'importe rien de next, react ni @supabase", () => {
    // Preuve statique : le module se limite a des types et des calculs, verifiable
    // par lecture ; la regle ESLint (no-restricted-imports sur src/core) le garantit
    // en continu. Ce test documente l'intention pour le lecteur du fichier de test.
    expect(typeof characterSheet).toBe("function");
  });
});

describe("characterSheet — encombrement (poids porte)", () => {
  const build: CharacterBuild = {
    species: "human",
    classes: [{ key: "fighter", level: 1 }],
    abilities: { assigned: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } },
    featureKeys: [],
  };
  // V3.1-115 : les seuils de charge viennent des regles du ruleset ; ces tests gardent la variante de 2014, passee en donnee.
  const ruleset: ResolvedRuleset = {
    classes: { fighter: FIGHTER },
    features: {},
    characterRules: {
      level_cap: 20,
      ability_score_cap: 20,
      ability_generation: {},
      encumbrance: {
        capacity_per_strength_lb: 15,
        tiers: [
          { above_per_strength_lb: 5, speed_penalty_ft: 10, disadvantage: [] },
          { above_per_strength_lb: 10, speed_penalty_ft: 20, disadvantage: ["str", "dex", "con"] },
        ],
      },
      sell_ratio: 0.5,
    },
  };

  it("carriedWeight par defaut (0) : aucun effet, comportement inchange pour les appelants existants", () => {
    const sheet = characterSheet(build, ruleset, [], []);
    expect(sheet.encumbrance).toEqual({ carried: 0, capacity: 150, tier: "none", speedPenalty: 0, disadvantageAbilities: [] });
    expect(sheet.speed.value).toBe(30);
  });

  it("lourdement encombre (FOR 10, > 100 lb) : vitesse reduite de 20, desavantage sur les sauvegardes FOR/DEX/CON", () => {
    const sheet = characterSheet(build, ruleset, [], [], 120);
    expect(sheet.encumbrance).toMatchObject({ tier: "heavily_encumbered", speedPenalty: 20 });
    expect(sheet.speed.value).toBe(10); // 30 (base) - 20
    expect(sheet.savingThrows.str.rollState).toBe("disadvantage");
    expect(sheet.savingThrows.dex.rollState).toBe("disadvantage");
    expect(sheet.savingThrows.con.rollState).toBe("disadvantage");
    expect(sheet.savingThrows.wis.rollState).toBe("normal");
    expect(sheet.skills.athletics.rollState).toBe("disadvantage");
    expect(sheet.skills.stealth.rollState).toBe("disadvantage");
  });
});

describe("layerForFeatureSource / resolveDeclaredModifiers — generalisation des modificateurs de fiche (retour utilisateur, don 'Malchanceux')", () => {
  it("une aptitude de classe (prefixe class:) vit en couche 3", () => {
    expect(layerForFeatureSource("class:fighter")).toBe(3);
  });

  it("un don accorde par un historique (prefixe background:) vit en couche 5, comme une amelioration de caracteristique", () => {
    expect(layerForFeatureSource("background:soldier")).toBe(5);
  });

  it("une source sans prefixe connu retombe en couche 5 (repli 'don') plutot que d'echouer", () => {
    expect(layerForFeatureSource("asi:fighter.l4")).toBe(5);
  });

  it("resolveDeclaredModifiers attache source/etiquette/couche sans toucher cible/effet/valeur", () => {
    const declared = [
      { target: "ability.wis", op: "add" as const, value: 1 },
      { target: "save.wis", op: "proficiency" as const },
    ];
    expect(resolveDeclaredModifiers(declared, "resilient", "Robuste", 5)).toEqual([
      { target: "ability.wis", op: "add", value: 1, source: "resilient", label: "Robuste", layer: 5 },
      { target: "save.wis", op: "proficiency", value: undefined, source: "resilient", label: "Robuste", layer: 5 },
    ]);
  });

  it("un don maison avec des modificateurs declares change reellement la fiche derivee (+1 SAG, maitrise de sauvegarde SAG)", () => {
    const build: CharacterBuild = {
      species: "human",
      classes: [{ key: "fighter", level: 1 }],
      abilities: { assigned: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
      featureKeys: ["resilient_wis"],
    };
    const ruleset: ResolvedRuleset = {
      classes: { fighter: FIGHTER },
      features: {
        resilient_wis: {
          key: "resilient_wis",
          label: "Robuste (Sagesse)",
          source: "background:soldier",
          modifiers: resolveDeclaredModifiers(
            [
              { target: "ability.wis", op: "add", value: 1 },
              { target: "save.wis", op: "proficiency" },
            ],
            "resilient_wis",
            "Robuste (Sagesse)",
            layerForFeatureSource("background:soldier")
          ),
        },
      },
    };
    const sheet = characterSheet(build, ruleset, [], []);
    expect(sheet.abilities.wis.score).toBe(11);
    expect(sheet.savingThrows.wis.proficient).toBe(true);
  });
});

describe("modificateur par niveau (V3.1-121, Ténacité naine)", () => {
  // Nain Clerc, CON 14 : le cas constaté le 11 octobre (10 PV au lieu de 11).
  const CLERIC = { key: "cleric", label: "Clerc", hitDie: 8, savingThrowProficiencies: ["wis", "cha"] as const };
  const tenacite = resolveDeclaredModifiers(
    [{ target: "hp.max", op: "add", value: 1, per_level: true }],
    "dwarven-toughness",
    "Ténacité naine",
    2
  );
  const nainClerc = (level: number): CharacterBuild => ({
    species: "dwarf",
    classes: [{ key: "cleric", level }],
    abilities: { assigned: { str: 10, dex: 10, con: 14, int: 10, wis: 15, cha: 10 } },
    featureKeys: ["species:dwarf"],
  });
  const ruleset: ResolvedRuleset = {
    classes: { cleric: CLERIC },
    features: { "species:dwarf": { key: "species:dwarf", label: "Nain", source: "species:dwarf", modifiers: tenacite } },
  };

  it("resolveDeclaredModifiers garde l'echelle par niveau", () => {
    expect(tenacite[0].perLevel).toBe(true);
  });

  it("un Nain niveau 1 gagne +1 PV max, avec la source « Ténacité naine »", () => {
    const sheet = characterSheet(nainClerc(1), ruleset, [], []);
    expect(sheet.hitPoints.max).toBe(8 + 2 + 1);
    expect(sheet.hitPoints.sources).toContainEqual({ label: "Ténacité naine", value: 1 });
  });

  it("puis +1 par niveau : niveau 4, +4", () => {
    const sheet = characterSheet(nainClerc(4), ruleset, [], []);
    // 8 (niveau 1) + 3 x 5 (moyenne d8) + CON 2 x 4 + Ténacité 4.
    expect(sheet.hitPoints.max).toBe(8 + 3 * averageHitDie(8) + 8 + 4);
    expect(sheet.hitPoints.sources).toContainEqual({ label: "Ténacité naine", value: 4 });
  });

  it("multiclassage : le niveau compte est celui du personnage, toutes classes", () => {
    const build: CharacterBuild = { ...nainClerc(2), classes: [{ key: "cleric", level: 2 }, { key: "fighter", level: 1 }] };
    const sheet = characterSheet(build, { ...ruleset, classes: { cleric: CLERIC, fighter: FIGHTER } }, [], []);
    expect(sheet.hitPoints.sources).toContainEqual({ label: "Ténacité naine", value: 3 });
  });

  it("sans echelle, un modificateur garde sa valeur fixe", () => {
    const fixe = resolveDeclaredModifiers([{ target: "hp.max", op: "add", value: 1 }], "x", "Fixe", 2);
    expect(fixe[0].perLevel).toBeUndefined();
    const sheet = characterSheet(nainClerc(4), { ...ruleset, features: { "species:dwarf": { key: "species:dwarf", label: "Nain", source: "species:dwarf", modifiers: fixe } } }, [], []);
    expect(sheet.hitPoints.sources).toContainEqual({ label: "Fixe", value: 1 });
  });
});

describe("règles de personnage du ruleset (V3.1-115)", () => {
  const regles = (cap: number) => ({
    level_cap: 20,
    ability_score_cap: cap,
    ability_generation: {},
    encumbrance: { capacity_per_strength_lb: 15, tiers: [] },
    sell_ratio: 0.5,
  });
  const build = (assigned: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>, featureKeys: string[] = []): CharacterBuild => ({
    species: "human",
    classes: [{ key: "fighter", level: 1 }],
    abilities: { assigned },
    featureKeys,
  });
  const base = { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const bonusFor2: ResolvedRuleset["features"] = {
    bonus: { key: "bonus", label: "+2 FOR", source: "species:x", modifiers: [{ target: "ability.str", op: "add", value: 2, source: "species:x", label: "+2 FOR", layer: 2 }] },
  };

  it("un ruleset au plafond 15 limite la Force à 15, même avec un bonus", () => {
    const sheet = characterSheet(build(base, ["bonus"]), { classes: { fighter: FIGHTER }, features: bonusFor2, characterRules: regles(15) }, [], []);
    expect(sheet.abilities.str.score).toBe(15);
  });

  it("au plafond 20, le même bonus donne 16", () => {
    const sheet = characterSheet(build(base, ["bonus"]), { classes: { fighter: FIGHTER }, features: bonusFor2, characterRules: regles(20) }, [], []);
    expect(sheet.abilities.str.score).toBe(16);
  });

  it("un objet qui FIXE la valeur n'est pas plafonné (Gantelets de puissance d'ogre : 19)", () => {
    const gantelets = { key: "g", label: "Gantelets", equipped: true, modifiers: [{ target: "ability.str", op: "set" as const, value: 19, source: "item:g", label: "Gantelets", layer: 6 as const }] };
    const sheet = characterSheet(build(base), { classes: { fighter: FIGHTER }, features: {}, characterRules: regles(15) }, [gantelets], []);
    expect(sheet.abilities.str.score).toBe(19);
  });

  it("la charge suit la règle du ruleset : FOR 17 à 165 lb n'est pas encombré en 2024", () => {
    const sheet = characterSheet(build({ ...base, str: 17 }), { classes: { fighter: FIGHTER }, features: {}, characterRules: regles(20) }, [], [], 165);
    expect(sheet.encumbrance).toMatchObject({ tier: "none", capacity: 255 });
  });

  it("sans règles de personnage, la fiche le dit au lieu d'inventer une valeur", () => {
    const sheet = characterSheet(build(base), { classes: { fighter: FIGHTER }, features: {} }, [], []);
    expect(sheet.warnings.map((w) => w.kind)).toContain("missing_character_rules");
    expect(sheet.encumbrance.tier).toBe("none");
  });
});

describe("characterSheet — jets de caractéristique et touche-à-tout (V3.1-46)", () => {
  const BARD = { key: "bard", label: "Barde", hitDie: 8, savingThrowProficiencies: ["dex", "cha"] as const };
  const touche = {
    key: "jack",
    label: "Touche-à-tout",
    source: "class:bard",
    modifiers: [{ target: "check", op: "half_proficiency" as const, layer: 3 as const, source: "class:bard", label: "Touche-à-tout" }],
  };
  const persuasion = {
    key: "persuasion",
    label: "Compétences de barde",
    source: "class:bard",
    modifiers: [{ target: "skill.persuasion", op: "proficiency" as const, layer: 3 as const, source: "class:bard", label: "Barde" }],
  };
  const expertise = {
    key: "expertise",
    label: "Expertise",
    source: "class:bard",
    modifiers: [{ target: "skill.performance", op: "expertise" as const, layer: 3 as const, source: "class:bard", label: "Barde" }],
  };
  const ruleset: ResolvedRuleset = { classes: { bard: BARD }, features: { jack: touche, persuasion, expertise } };
  const build = (level: number, featureKeys: string[]): CharacterBuild => ({
    species: "human",
    classes: [{ key: "bard", level }],
    abilities: { assigned: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 16 } },
    featureKeys,
  });

  it("sans touche-à-tout, un jet de caractéristique est le seul modificateur de la caractéristique", () => {
    const sheet = characterSheet(build(1, []), ruleset, [], []);
    expect(sheet.abilityChecks.str).toMatchObject({ mod: -1, rollState: "normal", halfProficiency: false });
    expect(sheet.abilityChecks.cha.mod).toBe(3);
  });

  it("touche-à-tout ajoute la moitié de la maîtrise (arrondie vers le bas) à tout jet sans maîtrise", () => {
    const sheet = characterSheet(build(1, ["jack"]), ruleset, [], []); // maîtrise +2 -> +1
    expect(sheet.abilityChecks.str).toMatchObject({ mod: 0, halfProficiency: true });
    expect(sheet.skills.athletics).toMatchObject({ mod: 0, proficiency: "half" });
    expect(sheet.abilityChecks.str.sources).toContainEqual({ label: "Touche-à-tout", value: 1 });
  });

  it("touche-à-tout ne s'ajoute jamais à une compétence maîtrisée ou experte", () => {
    const sheet = characterSheet(build(1, ["jack", "persuasion", "expertise"]), ruleset, [], []);
    expect(sheet.skills.persuasion).toMatchObject({ mod: 5, proficiency: "proficient" });
    expect(sheet.skills.performance).toMatchObject({ mod: 7, proficiency: "expertise" });
  });

  it("la moitié suit le bonus de maîtrise : +1 au niveau 5 (maîtrise +3), +2 au niveau 9 (maîtrise +4)", () => {
    expect(characterSheet(build(5, ["jack"]), ruleset, [], []).abilityChecks.str.mod).toBe(0);
    expect(characterSheet(build(9, ["jack"]), ruleset, [], []).abilityChecks.str.mod).toBe(1);
  });

  it("un avantage sur les jets de Force vaut aussi pour les compétences de Force", () => {
    const avantage: ActiveEffect = {
      key: "bulls_strength",
      label: "Force du taureau",
      modifiers: [{ target: "check.str", op: "advantage", layer: 7, source: "effect:bulls", label: "Force du taureau" }],
    };
    const sheet = characterSheet(build(1, []), ruleset, [], [avantage]);
    expect(sheet.abilityChecks.str.rollState).toBe("advantage");
    expect(sheet.skills.athletics.rollState).toBe("advantage");
    expect(sheet.skills.acrobatics.rollState).toBe("normal");
  });
});
