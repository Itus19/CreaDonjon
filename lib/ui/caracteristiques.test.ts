import { describe, expect, it } from "vitest";
import { echangerValeurs, peutAugmenter, peutDiminuer, repartirSelonPriorite } from "./caracteristiques";

const POINT_BUY = { budget: 27, min: 8, max: 15, costs: { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9 } };

describe("la suggestion : les valeurs selon la classe (V3.1-52)", () => {
  it("la plus haute à la caractéristique principale, et ainsi de suite (ordre lu dans le ruleset)", () => {
    expect(repartirSelonPriorite([15, 14, 13, 12, 10, 8], ["wis", "con", "str", "dex", "cha", "int"])).toEqual({
      wis: 15, con: 14, str: 13, dex: 12, cha: 10, int: 8,
    });
  });

  it("une priorité incomplète : les caractéristiques restantes prennent le reste, dans l'ordre FOR → CHA", () => {
    expect(repartirSelonPriorite([8, 15, 10, 14, 12, 13], ["dex"])).toEqual({ dex: 15, str: 14, con: 13, int: 12, wis: 10, cha: 8 });
  });

  it("sans priorité : l'ordre FOR → CHA", () => {
    expect(repartirSelonPriorite([15, 14, 13, 12, 10, 8], [])).toEqual({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  });
});

describe("l'échange de deux cases", () => {
  it("les deux valeurs changent de place, le reste ne bouge pas", () => {
    const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    expect(echangerValeurs(base, "str", "wis")).toEqual({ ...base, str: 10, wis: 15 });
    expect(echangerValeurs(base, "dex", "dex")).toEqual(base);
  });
});

describe("l'achat de points : le budget ne se dépasse pas", () => {
  const base = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };

  it("le + se grise quand il dépasserait le budget (27 points, 15/15/15 coûtent 27)", () => {
    expect(peutAugmenter(base, "int", POINT_BUY)).toBe(false);
  });

  it("le + se grise au plafond de l'achat (15), même avec du budget", () => {
    const peu = { str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    expect(peutAugmenter(peu, "str", POINT_BUY)).toBe(false);
    expect(peutAugmenter(peu, "dex", POINT_BUY)).toBe(true);
  });

  it("le − se grise au plancher (8)", () => {
    expect(peutDiminuer(base, "int", POINT_BUY)).toBe(false);
    expect(peutDiminuer(base, "str", POINT_BUY)).toBe(true);
  });
});
