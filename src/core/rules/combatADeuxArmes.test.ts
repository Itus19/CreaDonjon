import { describe, expect, it } from "vitest";
import { lightExtraDamageMod } from "./action";
import { lightExtraAddsAbility, type Modifier } from "./sheet";
import { EMPTY_TURN_BUDGET, spendLightExtraAttack, spendTurnBudget } from "./turnBudget";
import { modifierTargetOption, OPS_BY_TARGET_CATEGORY } from "./modifierTargets";

/**
 * Combat à deux armes (don de Style de combat) — « lorsque vous effectuez une
 * attaque supplémentaire résultant de l'emploi d'une arme avec la propriété
 * Légère, vous pouvez ajouter votre modificateur de caractéristique aux
 * dégâts de cette attaque ». La propriété Légère (2024) : après une attaque
 * de l'action Attaque avec une arme Légère, une attaque en plus en action
 * Bonus, avec une autre arme Légère, sans le modificateur aux dégâts (sauf
 * s'il est négatif).
 */

const DEUX_ARMES: Modifier = { target: "light_extra.ability_damage", op: "set", value: 1, source: "feat:two-weapon-fighting", label: "Combat à deux armes", layer: 6 };

describe("les dégâts de l'attaque en plus", () => {
  it("sans le don : pas de modificateur positif, mais un négatif compte", () => {
    expect(lightExtraDamageMod(3, false)).toBe(0);
    expect(lightExtraDamageMod(-1, false)).toBe(-1);
  });

  it("avec le don : le modificateur s'ajoute", () => {
    expect(lightExtraDamageMod(3, true)).toBe(3);
  });

  it("la fiche dit si le don est là", () => {
    expect(lightExtraAddsAbility({ rollModifiers: [DEUX_ARMES] })).toBe(true);
    expect(lightExtraAddsAbility({ rollModifiers: [] })).toBe(false);
  });

  it("la cible se saisit dans l'éditeur", () => {
    expect(modifierTargetOption("light_extra.ability_damage")?.category).toBe("light_extra");
    expect(OPS_BY_TARGET_CATEGORY.light_extra).toEqual(["set"]);
  });
});

describe("l'économie de l'attaque en plus", () => {
  const neuf = { ...EMPTY_TURN_BUDGET, at: "1:0" };

  it("après une attaque avec une arme Légère : une action Bonus, sans dépassement", () => {
    const apres = spendTurnBudget(neuf, "attack", 1, { lightWeapon: true }).budget;
    expect(apres.lightAttack).toBe(true);
    const r = spendLightExtraAttack(apres);
    expect(r.over).toBe(false);
    expect(r.budget.bonus).toBe(0);
  });

  it("sans attaque Légère avant, ou une seconde fois : signalé (jamais bloquant)", () => {
    expect(spendLightExtraAttack(neuf).over).toBe(true);
    const lourde = spendTurnBudget(neuf, "attack", 1).budget;
    expect(lourde.lightAttack).toBeUndefined();
    expect(spendLightExtraAttack(lourde).over).toBe(true);
    const une = spendLightExtraAttack(spendTurnBudget(neuf, "attack", 1, { lightWeapon: true }).budget).budget;
    expect(spendLightExtraAttack({ ...une, bonus: 1 }).over).toBe(true);
  });

  it("une attaque Légère en dépassement n'ouvre pas l'attaque en plus", () => {
    const sansAction = { ...neuf, action: 0 };
    expect(spendTurnBudget(sansAction, "attack", 1, { lightWeapon: true }).budget.lightAttack).toBeUndefined();
  });
});
