import { describe, expect, it } from "vitest";
import {
  advanceTurnSkipping,
  attackVerdict,
  damageAfterSave,
  isOutOfFight,
  monsterSaveBonus,
  retreatTurnSkipping,
} from "./targeting";

/** V3.1-105 (ADR 0042) — ce que le cœur de résolution décide, sans base ni dé. */
describe("attackVerdict (règles 2024)", () => {
  const roll = (total: number, isCritical = false, isCriticalFail = false) => ({ total, isCritical, isCriticalFail });

  it("touche quand le total atteint la CA, rate sinon", () => {
    expect(attackVerdict(roll(15), 15)).toBe("hit");
    expect(attackVerdict(roll(14), 15)).toBe("miss");
  });

  it("un 20 naturel touche toujours, un 1 naturel rate toujours", () => {
    expect(attackVerdict(roll(12, true), 25)).toBe("hit");
    expect(attackVerdict(roll(30, false, true), 10)).toBe("miss");
  });

  it("sans CA connue, pas de verdict : la table tranche", () => {
    expect(attackVerdict(roll(18), null)).toBeNull();
  });
});

describe("damageAfterSave", () => {
  it("sauvegarde ratée : tous les dégâts", () => {
    expect(damageAfterSave(17, false, "half")).toBe(17);
  });

  it("réussie avec « moitié » : la moitié arrondie à l'inférieur", () => {
    expect(damageAfterSave(17, true, "half")).toBe(8);
    expect(damageAfterSave(17, true, "Moitié des dégâts")).toBe(8);
  });

  it("réussie sans moitié : aucun dégât", () => {
    expect(damageAfterSave(17, true, undefined)).toBe(0);
    expect(damageAfterSave(17, true, "Aucun dégât")).toBe(0);
  });
});

describe("monsterSaveBonus", () => {
  const block = { abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, saving_throws: [{ ability: "DEX", bonus: 6 }] };

  it("la sauvegarde maîtrisée du bloc de stats", () => {
    expect(monsterSaveBonus(block, "dex")).toBe(6);
  });

  it("sinon le modificateur de la caractéristique", () => {
    expect(monsterSaveBonus(block, "wis")).toBe(-1);
    expect(monsterSaveBonus({ abilities: block.abilities }, "dex")).toBe(2);
  });
});

describe("hors de l'initiative", () => {
  it("une créature à 0 PV est hors de combat ; un PJ à 0 PV reste dans l'ordre (jets contre la mort)", () => {
    expect(isOutOfFight({ isPc: false, hpCurrent: 0, hpMax: 7 })).toBe(true);
    expect(isOutOfFight({ isPc: true, hpCurrent: 0, hpMax: 12 })).toBe(false);
    expect(isOutOfFight({ isPc: false, hpCurrent: 3, hpMax: 7 })).toBe(false);
    expect(isOutOfFight({ isPc: false, hpCurrent: null, hpMax: null })).toBe(false);
  });

  const out = [false, true, false, true];

  it("le tour suivant saute les créatures hors de combat, et le round passe en bouclant", () => {
    expect(advanceTurnSkipping({ round: 1, turnIndex: 0 }, out)).toEqual({ round: 1, turnIndex: 2 });
    expect(advanceTurnSkipping({ round: 1, turnIndex: 2 }, out)).toEqual({ round: 2, turnIndex: 0 });
  });

  it("le tour précédent les saute aussi, et revient au round d'avant", () => {
    expect(retreatTurnSkipping({ round: 2, turnIndex: 0 }, out)).toEqual({ round: 1, turnIndex: 2 });
    expect(retreatTurnSkipping({ round: 1, turnIndex: 2 }, out)).toEqual({ round: 1, turnIndex: 0 });
  });

  it("si tout le monde est hors de combat, le tour avance comme avant", () => {
    expect(advanceTurnSkipping({ round: 1, turnIndex: 0 }, [true, true])).toEqual({ round: 1, turnIndex: 1 });
  });
});
