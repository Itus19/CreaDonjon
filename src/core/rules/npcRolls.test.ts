import { describe, expect, it } from "vitest";
import { npcAttackFromAction, npcAttacks, resoudreAttaquePnj, tactiqueDuPnj } from "./npcRolls";

describe("npcAttackFromAction (attaque d'une action de fiche allégée, SRD 2024)", () => {
  it("lit le bonus d'attaque et les dés de dégâts d'une attaque au corps à corps", () => {
    expect(npcAttackFromAction({ name: "Scimitar", text: "Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Slashing damage." })).toEqual({
      name: "Scimitar",
      melee: true,
      ranged: false,
      attackBonus: 3,
      damage: [{ count: 1, faces: 6, bonus: 1, type: "slashing" }],
    });
  });

  it("une arme de jet est à la fois au corps à corps et à distance", () => {
    const lance = npcAttackFromAction({ name: "Spear", text: "Melee or Ranged Attack Roll: +3, reach 5 ft. or range 20/60 ft. Hit: 4 (1d6 + 1) Piercing damage." });
    expect(lance).toMatchObject({ melee: true, ranged: true, attackBonus: 3 });
  });

  it("des dégâts sans modificateur, plusieurs types, un bonus négatif", () => {
    expect(npcAttackFromAction({ name: "Club", text: "Melee Attack Roll: +2, reach 5 ft. Hit: 2 (1d4) Bludgeoning damage." })?.damage).toEqual([{ count: 1, faces: 4, bonus: 0, type: "bludgeoning" }]);
    expect(npcAttackFromAction({ name: "Bite", text: "Melee Attack Roll: +8, reach 10 ft. Hit: 17 (2d12 + 4) Piercing damage plus 22 (4d10) Poison damage." })?.damage).toEqual([
      { count: 2, faces: 12, bonus: 4, type: "piercing" },
      { count: 4, faces: 10, bonus: 0, type: "poison" },
    ]);
    expect(npcAttackFromAction({ name: "Faible", text: "Melee Attack Roll: -1, reach 5 ft. Hit: 1 (1d4 - 1) Bludgeoning damage." })).toMatchObject({ attackBonus: -1, damage: [{ count: 1, faces: 4, bonus: -1 }] });
  });

  it("des dégâts fixes, sans dé", () => {
    expect(npcAttackFromAction({ name: "Unarmed Strike", text: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Bludgeoning damage." })?.damage).toEqual([{ count: 0, faces: 0, bonus: 1, type: "bludgeoning" }]);
  });

  it("une action qui n'est pas une attaque ne donne rien", () => {
    expect(npcAttackFromAction({ name: "Multiattack", text: "The guard makes two Spear attacks." })).toBeNull();
    expect(npcAttackFromAction({ name: "Spittle", text: "Constitution Saving Throw: DC 16. Failure: 31 (7d8) Poison damage." })).toBeNull();
  });

  it("npcAttacks garde les attaques de la fiche, dans l'ordre", () => {
    const attaques = npcAttacks([
      { name: "Multiattack", text: "Two attacks." },
      { name: "Mace", text: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Bludgeoning damage." },
      { name: "Heavy Crossbow", text: "Ranged Attack Roll: +3, range 100/400 ft. Hit: 6 (1d10 + 1) Piercing damage." },
    ]);
    expect(attaques.map((a) => a.name)).toEqual(["Mace", "Heavy Crossbow"]);
  });
});

describe("tactiqueDuPnj (ADR 0121, tactique fixe)", () => {
  const massue = npcAttackFromAction({ name: "Club", text: "Melee Attack Roll: +2, reach 5 ft. Hit: 2 (1d4) Bludgeoning damage." })!;
  const masse = npcAttackFromAction({ name: "Mace", text: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Bludgeoning damage." })!;
  const arbalete = npcAttackFromAction({ name: "Crossbow", text: "Ranged Attack Roll: +3, range 100/400 ft. Hit: 6 (1d10 + 1) Piercing damage." })!;
  const ennemis = [{ id: "allie", joueur: false }, { id: "pj", joueur: true }];

  it("au contact, la meilleure attaque au corps à corps, sur la personne qui joue", () => {
    expect(tactiqueDuPnj({ zone: "engaged", attaques: [massue, masse, arbalete], ennemis })).toEqual({ kind: "attack", attack: masse, targetId: "pj", approche: false });
  });

  it("proche, il se rapproche pour frapper", () => {
    expect(tactiqueDuPnj({ zone: "near", attaques: [massue], ennemis })).toMatchObject({ kind: "attack", approche: true });
  });

  it("loin, il tire s'il peut, sinon il s'approche", () => {
    expect(tactiqueDuPnj({ zone: "far", attaques: [massue, arbalete], ennemis })).toMatchObject({ kind: "attack", attack: arbalete });
    expect(tactiqueDuPnj({ zone: "far", attaques: [massue], ennemis })).toEqual({ kind: "approach" });
  });

  it("sans attaque ou sans ennemi, il esquive", () => {
    expect(tactiqueDuPnj({ zone: "engaged", attaques: [], ennemis })).toEqual({ kind: "dodge" });
    expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: [] })).toEqual({ kind: "dodge" });
  });

  describe("selon son but (ADR 0122)", () => {
    const trois = [
      { id: "pj", joueur: true, pv: 11 },
      { id: "ami", joueur: false, pv: 3 },
      { id: "chef", joueur: false, pv: 8, menace: true },
    ];

    it("arrêter ou défendre : il vise celui qui menace", () => {
      expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: trois, but: "arreter" })).toMatchObject({ targetId: "chef" });
      expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: trois, but: "defendre" })).toMatchObject({ targetId: "chef" });
    });

    it("piller : il vise le plus faible", () => {
      expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: trois, but: "piller" })).toMatchObject({ targetId: "ami" });
    });

    it("vaincre : le personnage d'abord", () => {
      expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: trois, but: "vaincre" })).toMatchObject({ targetId: "pj" });
    });

    it("survivre : il frappe au contact, sinon il esquive sans s'approcher", () => {
      expect(tactiqueDuPnj({ zone: "engaged", attaques: [masse], ennemis: trois, but: "survivre" })).toMatchObject({ kind: "attack", targetId: "chef", approche: false });
      expect(tactiqueDuPnj({ zone: "near", attaques: [masse, arbalete], ennemis: trois, but: "survivre" })).toEqual({ kind: "dodge" });
    });
  });
});

describe("resoudreAttaquePnj (règles 2024)", () => {
  const masse = npcAttackFromAction({ name: "Mace", text: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Bludgeoning damage." })!;
  const des = (...valeurs: number[]) => {
    let i = 0;
    return { nextInt: (max: number) => Math.min(max - 1, valeurs[i++]! - 1) };
  };

  it("touche quand le total atteint la CA, et lance les dégâts", () => {
    expect(resoudreAttaquePnj(masse, 14, des(10, 3))).toMatchObject({ naturel: 10, total: 14, touche: true, critique: false, degats: 5 });
  });

  it("rate sous la CA, sans dégâts", () => {
    expect(resoudreAttaquePnj(masse, 16, des(10))).toMatchObject({ touche: false, degats: 0 });
  });

  it("un 20 naturel touche et double les dés ; un 1 naturel rate", () => {
    expect(resoudreAttaquePnj(masse, 30, des(20, 6, 6))).toMatchObject({ touche: true, critique: true, degats: 14 });
    expect(resoudreAttaquePnj(masse, 2, des(1))).toMatchObject({ touche: false });
  });

  it("sans CA connue, pas de verdict", () => {
    expect(resoudreAttaquePnj(masse, null, des(10))).toMatchObject({ touche: null, degats: 0 });
  });
});
