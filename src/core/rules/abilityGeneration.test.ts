import { describe, expect, it } from "vitest";
import { POINT_BUY_BUDGET, POINT_BUY_MAX, POINT_BUY_MIN, STANDARD_ARRAY, pointBuyCost } from "./abilityGeneration";

describe("pointBuyCost", () => {
  it("vaut 0 quand les six caracteristiques sont au plancher", () => {
    expect(pointBuyCost({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(0);
  });

  it("consomme tout le budget officiel sur une repartition 15/15/15/8/8/8", () => {
    // Cout officiel (PHB) : 15 = 9, 8 = 0 -> 3*9 = 27, exactement le budget.
    expect(pointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(POINT_BUY_BUDGET);
  });

  it("applique le cout non lineaire de 14 et 15 (7 et 9, pas 6 et 7)", () => {
    expect(pointBuyCost({ str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(9);
    expect(pointBuyCost({ str: 14, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(7);
  });

  it("rejette une valeur hors bornes (8 a 15) avec un cout infini plutot qu'un cout invente", () => {
    expect(pointBuyCost({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(Infinity);
    expect(pointBuyCost({ str: 7, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(Infinity);
  });
});

describe("STANDARD_ARRAY / bornes point-buy", () => {
  it("expose le tableau standard officiel", () => {
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });

  it("expose les bornes officielles de l'achat de points", () => {
    expect(POINT_BUY_MIN).toBe(8);
    expect(POINT_BUY_MAX).toBe(15);
  });
});
