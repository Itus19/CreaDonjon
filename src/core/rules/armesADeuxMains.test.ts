import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { resolveDamageRoll } from "./action";
import { rollBonus, type Modifier } from "./sheet";
import { weaponRollProperties } from "./srdMapping";
import { applyRollOperations, type PendingRoll } from "./rollWindow";
import { modifierTargetOption, OPS_BY_TARGET_CATEGORY } from "./modifierTargets";

/**
 * Armes à deux mains (don de Style de combat) — « lorsque vous lancez les
 * dégâts d'une attaque effectuée avec une arme de corps à corps tenue à deux
 * mains, vous pouvez considérer tous les 1 et 2 obtenus aux dés de dégâts
 * comme des 3 ». Une arme Deux mains, ou Polyvalente tenue à deux mains.
 */

/** Un Rng qui rend les valeurs données (0-indexées : 0 = un 1 au dé). */
function des(...valeurs: number[]): Rng {
  let i = 0;
  return { nextInt: () => valeurs[i++] ?? 0 };
}

const PLANCHER: Modifier = { target: "die_min.weapon", op: "set", value: 3, when: { wielding: "melee-two-handed" }, source: "feat:great-weapon-fighting", label: "Armes à deux mains", layer: 6 };

describe("la prise à deux mains d'une arme de corps à corps", () => {
  const arme = (properties: string[], isRanged = false) => ({ properties, isRanged });

  it("une arme Deux mains de corps à corps l'est toujours ; une arme à distance Deux mains (arc long), jamais", () => {
    expect(weaponRollProperties(arme(["heavy", "two-handed"]))).toContain("melee-two-handed");
    expect(weaponRollProperties(arme(["ammunition", "heavy", "two-handed"], true))).not.toContain("melee-two-handed");
  });

  it("une arme Polyvalente seulement quand on la tient à deux mains", () => {
    expect(weaponRollProperties(arme(["versatile"]))).not.toContain("melee-two-handed");
    expect(weaponRollProperties(arme(["versatile"]), { twoHanded: true })).toContain("melee-two-handed");
    expect(weaponRollProperties(arme(["finesse", "light"]), { twoHanded: true })).not.toContain("melee-two-handed");
  });
});

describe("le plancher des dés de dégâts", () => {
  it("rollBonus le donne pour une arme tenue à deux mains, pas pour une autre", () => {
    const fiche = { rollModifiers: [PLANCHER] };
    expect(rollBonus(fiche, { roll: "damage", kind: "weapon", properties: ["two-handed", "melee-two-handed"] }).dieMin).toBe(3);
    expect(rollBonus(fiche, { roll: "damage", kind: "weapon", properties: ["finesse"] }).dieMin).toBeNull();
    expect(rollBonus(fiche, { roll: "attack", kind: "weapon", properties: ["two-handed", "melee-two-handed"] }).dieMin).toBeNull();
  });

  it("2d6 : un 1 et un 2 comptent comme des 3 ; un 5 reste 5 ; le modificateur s'ajoute après", () => {
    const r = resolveDamageRoll({ formula: "2d6", abilityMod: 3, critical: false, dieMin: 3 }, des(0, 1));
    expect(r.total).toBe(9);
    expect(resolveDamageRoll({ formula: "2d6", abilityMod: 3, critical: false, dieMin: 3 }, des(0, 4)).total).toBe(11);
    expect(r.weaponDice).toEqual({ count: 2, faces: 6, sum: 6, min: 3 });
  });

  it("les dés de bonus de l'attaque comptent aussi ; sans plancher, rien ne change", () => {
    expect(resolveDamageRoll({ formula: "1d12", critical: false, dieMin: 3, bonusDice: [{ count: 1, faces: 4, label: "Bénédiction", source: "x" }] }, des(0, 0)).total).toBe(6);
    expect(resolveDamageRoll({ formula: "2d6", critical: false }, des(0, 1)).total).toBe(3);
  });

  it("Sauvagerie martiale relance avec le même plancher", () => {
    const jet: PendingRoll = { kind: "damage", roller: "edran", target: "x", natural: null, total: 9, critRange: 20, ac: null, dc: null, acBonus: 0, damage: { base: 9, multiplier: 1, weaponDice: { count: 2, faces: 6, sum: 6, min: 3 } } };
    // Deux 1 relancés comptent 3 + 3 = 6 : pas mieux, le premier jet reste.
    expect(applyRollOperations(jet, [{ actorId: "edran", operations: [{ op: "reroll_weapon_dice" }], numbers: {} }], des(0, 0)).roll.total).toBe(9);
    // 1 et 6 : 3 + 6 = 9, mieux de 3.
    expect(applyRollOperations(jet, [{ actorId: "edran", operations: [{ op: "reroll_weapon_dice" }], numbers: {} }], des(0, 5)).roll.total).toBe(12);
  });

  it("la cible se saisit dans l'éditeur", () => {
    expect(modifierTargetOption("die_min.weapon")?.category).toBe("die_min");
    expect(OPS_BY_TARGET_CATEGORY.die_min).toEqual(["set"]);
  });
});
