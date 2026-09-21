import { describe, expect, it } from "vitest";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import { buildActorState, entryKeysForFeatures } from "./triggerRuntime";

/**
 * `buildActorState` definit LE VOCABULAIRE DE REFERENCES qu'un auteur de
 * regle pourra ecrire dans une condition (`{ op: "ref", name: "save.con" }`).
 * Le renommer casse silencieusement toutes les regles deja saisies : d'ou
 * ces tests, qui verrouillent les noms autant que les valeurs.
 */

const sheet = {
  abilities: {
    str: { score: 10, mod: 0, sources: [] },
    dex: { score: 16, mod: 3, sources: [] },
    con: { score: 14, mod: 2, sources: [] },
    int: { score: 8, mod: -1, sources: [] },
    wis: { score: 12, mod: 1, sources: [] },
    cha: { score: 18, mod: 4, sources: [] },
  },
  proficiencyBonus: 3,
  ac: { value: 15, sources: [] },
  savingThrows: {
    str: { mod: 0, proficient: false, rollState: "normal", sources: [] },
    dex: { mod: 6, proficient: true, rollState: "normal", sources: [] },
    con: { mod: 2, proficient: false, rollState: "normal", sources: [] },
    int: { mod: -1, proficient: false, rollState: "normal", sources: [] },
    wis: { mod: 1, proficient: false, rollState: "normal", sources: [] },
    cha: { mod: 4, proficient: false, rollState: "normal", sources: [] },
  },
  skills: {},
  hitPoints: { max: 27, hitDice: "3d8", sources: [] },
  speed: { value: 30, sources: [] },
  features: [
    { key: "alert", label: "Vigilant", source: "feat", modifiers: [] },
    { key: "second-wind", label: "Second souffle", source: "class:fighter", modifiers: [] },
  ],
  warnings: [],
  encumbrance: {},
} as unknown as DerivedSheet;

const runtime = {
  hp: { current: 11, temp: 2 },
  hit_dice: { d8: 3 },
  exhaustion: 1,
  xp: 0,
  resources: {},
  spell_slots_used: {},
  conditions: ["concentrating", "prone"],
  death_saves: { success: 0, fail: 0 },
  attuned: [],
} satisfies RuntimeState;

describe("buildActorState", () => {
  it("expose les modificateurs de sauvegarde sous `save.<carac>`", () => {
    // C'est le nom qu'attend `saving_throw` dans un effet : les deux doivent
    // rester d'accord, sinon un jet declenche partirait sans bonus.
    expect(buildActorState(sheet).numbers["save.dex"]).toBe(6);
    expect(buildActorState(sheet).numbers["save.con"]).toBe(2);
  });

  it("expose les caracteristiques, la CA, la vitesse et la maitrise", () => {
    const n = buildActorState(sheet).numbers;
    expect(n).toMatchObject({ "ability.cha": 4, "ac": 15, "speed": 30, "proficiency": 3, "hp.max": 27 });
  });

  it("reprend les conditions de l'etat d'execution, que `has_condition` interroge", () => {
    expect(buildActorState(sheet, runtime).conditions).toEqual(["concentrating", "prone"]);
  });

  it("ajoute les PV courants SEULEMENT quand l'etat d'execution est connu", () => {
    expect(buildActorState(sheet).numbers["hp.current"]).toBeUndefined();
    expect(buildActorState(sheet, runtime).numbers).toMatchObject({
      "hp.current": 11,
      "hp.temp": 2,
      "exhaustion": 1,
    });
  });

  it("expose les cles d'aptitude — les MEMES que celles dont on lit les declencheurs", () => {
    // Une aptitude qui porte une regle peut donc se tester elle-meme
    // (`has_feature`), ce qui est la maniere d'ecrire « tant que Rage est
    // active ».
    expect(buildActorState(sheet).features).toEqual(["alert", "second-wind"]);
  });
});

/**
 * Regression trouvee en verification EN DIRECT, pas par un test : le cablage
 * passait `sheet.features[].key` tel quel au magasin, alors qu'un tiers de
 * ces cles ne sont pas des entrees de ruleset. Les declencheurs d'une espece
 * ou d'un historique etaient donc introuvables, en silence.
 */
describe("entryKeysForFeatures", () => {
  it("retire le prefixe d'affichage d'une espece et d'un historique", () => {
    expect(
      entryKeysForFeatures([{ key: "species:fiendish-legacy-infernal" }, { key: "background:artiste" }]),
    ).toEqual(["fiendish-legacy-infernal", "artiste"]);
  });

  it("laisse intacte une cle d'entree ordinaire", () => {
    expect(entryKeysForFeatures([{ key: "rogue-sneak-attack" }, { key: "musicien" }])).toEqual([
      "rogue-sneak-attack",
      "musicien",
    ]);
  });

  it("ecarte les marqueurs de choix, qui ne sont aucune entree", () => {
    expect(entryKeysForFeatures([{ key: "choice:rogue.skills" }, { key: "musicien" }])).toEqual(["musicien"]);
  });

  it("ne coupe PAS au premier `:` venu — un prefixe inconnu reste une cle", () => {
    // Couper aveuglement ferait disparaitre les declencheurs d'une cle
    // legitime qui contiendrait un deux-points, sans rien signaler.
    expect(entryKeysForFeatures([{ key: "maison:regle-perso" }])).toEqual(["maison:regle-perso"]);
  });

  it("dedoublonne", () => {
    expect(entryKeysForFeatures([{ key: "species:x" }, { key: "x" }])).toEqual(["x"]);
  });
});
