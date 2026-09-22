import { describe, expect, it } from "vitest";
import type { StatBlockBlockData } from "../schemas/rule-blocks/blocks";
import { buildMonsterActorState } from "./monsterActor";

const GOBELIN = {
  size: "Small",
  creature_type: "Fey",
  armor_class: 15,
  hit_points: 7,
  hit_dice: "2d6",
  speed: { walk: "30 ft." },
  abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
  saving_throws: [{ ability: "dex", bonus: 4 }],
  challenge_rating: 0.25,
  proficiency_bonus: 2,
} as unknown as StatBlockBlockData;

describe("un monstre devient un acteur sans fiche dérivée", () => {
  it("lit CA, PV et maîtrise depuis le bloc", () => {
    const a = buildMonsterActorState(GOBELIN);
    expect(a.numbers).toMatchObject({ ac: 15, "hp.max": 7, proficiency: 2 });
  });

  it("dérive les modificateurs de caractéristique", () => {
    const a = buildMonsterActorState(GOBELIN);
    expect(a.numbers["ability.dex"]).toBe(2); // (15-10)/2
    expect(a.numbers["ability.str"]).toBe(-1); // (8-10)/2 arrondi vers le bas
  });

  it("prend le bonus de sauvegarde MAÎTRISÉ tel quel, sans y rajouter la maîtrise", () => {
    // Le SRD donne le bonus TOTAL (+4 en Dex pour le gobelin). Recalculer
    // « mod + maîtrise » le doublerait sur les monstres légendaires.
    expect(buildMonsterActorState(GOBELIN).numbers["save.dex"]).toBe(4);
  });

  it("retombe sur le modificateur pour une sauvegarde non maîtrisée", () => {
    expect(buildMonsterActorState(GOBELIN).numbers["save.con"]).toBe(0);
    expect(buildMonsterActorState(GOBELIN).numbers["save.wis"]).toBe(-1);
  });
});

describe("l'état vivant du combat prime sur la fiche", () => {
  it("les PV courants viennent du participant, jamais du bloc", () => {
    const a = buildMonsterActorState(GOBELIN, { hpCurrent: 3, tempHp: 2 });
    expect(a.numbers["hp.current"]).toBe(3);
    expect(a.numbers["hp.temp"]).toBe(2);
    expect(a.numbers["hp.max"]).toBe(7);
  });

  it("une CA corrigée à la main par le MJ écrase celle de la fiche", () => {
    expect(buildMonsterActorState(GOBELIN, { ac: 18 }).numbers["ac"]).toBe(18);
  });

  it("`null` n'écrase rien — c'est « non renseigné », pas « zéro »", () => {
    // Les colonnes du participant sont nullables : confondre les deux
    // donnerait une CA 0 à tout monstre dont la ligne ne la précise pas.
    const a = buildMonsterActorState(GOBELIN, { ac: null, hpMax: null });
    expect(a.numbers["ac"]).toBe(15);
    expect(a.numbers["hp.max"]).toBe(7);
  });

  it("reprend conditions et zone du participant", () => {
    const a = buildMonsterActorState(GOBELIN, { conditions: ["poisoned"], zone: "near" });
    expect(a.conditions).toEqual(["poisoned"]);
    expect(a.zone).toBe("near");
  });
});

describe("sans bloc `stat_block`", () => {
  it("rend un acteur utilisable plutôt que de lever", () => {
    // Un participant libre (« Garde n° 3 ») n'a aucune fiche : il doit
    // quand même pouvoir porter des conditions et une zone.
    const a = buildMonsterActorState(undefined, { hpCurrent: 5, conditions: ["prone"] });
    expect(a.conditions).toEqual(["prone"]);
    expect(a.numbers["hp.current"]).toBe(5);
    expect(a.numbers["ac"]).toBeUndefined();
  });
});

describe("ce qu'un monstre ne sait pas faire", () => {
  it("`has_feature` est toujours faux : ses traits n'ont pas de clé interrogeable", () => {
    expect(buildMonsterActorState(GOBELIN).features).toEqual([]);
  });
});
