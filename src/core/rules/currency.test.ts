import { describe, expect, it } from "vitest";
import { COIN_VALUE_CP, CURRENCY_ORDER, depositCoins, spendCoins, type Currency } from "./currency";

const empty: Currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

describe("depositCoins", () => {
  it("ajoute au type choisi quand ca ne franchit aucun seuil de conversion", () => {
    const currency: Currency = { ...empty, gp: 5, sp: 3 };
    expect(depositCoins(currency, "gp", 4)).toEqual({ ...empty, gp: 9, sp: 3 });
  });

  it("part de zero si le porte-monnaie est vide", () => {
    expect(depositCoins(empty, "cp", 7)).toEqual({ ...empty, cp: 7 });
  });

  it("convertit vers la piece superieure des que le seuil est franchi (sur retour utilisateur)", () => {
    // 9 po + 1 po = 10 po = 1 pp : la meme conversion automatique qu'a la
    // depense, mais dans l'autre sens.
    const currency: Currency = { ...empty, gp: 9 };
    expect(depositCoins(currency, "gp", 1)).toEqual({ ...empty, pp: 1 });
  });

  it("recompose tout le porte-monnaie, pas seulement le type depose", () => {
    // 23 pa = 230 pc. Deposer 2 pa (250 pc) recompose en 2 po + 1 pe : les
    // pa de depart disparaissent completement, pas seulement le surplus.
    const currency: Currency = { ...empty, sp: 23 };
    expect(depositCoins(currency, "sp", 2)).toEqual({ ...empty, gp: 2, ep: 1 });
  });
});

describe("spendCoins", () => {
  it("retire directement quand le type choisi suffit", () => {
    const currency: Currency = { ...empty, gp: 10 };
    expect(spendCoins(currency, "gp", 5)).toEqual({ ...empty, gp: 5 });
  });

  it("casse une piece plus grosse quand le type choisi ne suffit pas, et recompose avec le moins de pieces possible", () => {
    // 1 pp + 10 po = 2000 pc. On retire 15 po (1500 pc) : il reste 500 pc,
    // qui se recompose en 5 po (aucune pp ne peut plus se justifier).
    const currency: Currency = { ...empty, pp: 1, gp: 10 };
    expect(spendCoins(currency, "gp", 15)).toEqual({ ...empty, gp: 5 });
  });

  it("bloque et ne modifie rien si la valeur totale ne suffit pas", () => {
    // 1 pp + 10 po = 2000 pc, retirer 50 po (5000 pc) est impossible.
    const currency: Currency = { ...empty, pp: 1, gp: 10 };
    expect(spendCoins(currency, "gp", 50)).toBeNull();
  });

  it("vide exactement le porte-monnaie sans reste", () => {
    const currency: Currency = { ...empty, cp: 5 };
    expect(spendCoins(currency, "cp", 5)).toEqual(empty);
  });

  it("recompose toujours du plus gros au plus petit, pieces d'electrum comprises", () => {
    // 25 pa (250 pc) + 3 pc = 253 pc. Retirer 3 pc laisse 250 pc, qui se
    // recompose en 2 po + 1 pe (3 pieces, moins que 2 po + 5 pa qui en ferait 7).
    const currency: Currency = { ...empty, sp: 25, cp: 3 };
    expect(spendCoins(currency, "cp", 3)).toEqual({ ...empty, gp: 2, ep: 1 });
  });
});

describe("CURRENCY_ORDER / COIN_VALUE_CP", () => {
  it("va du plus gros au plus petit et suit le taux d'echange standard", () => {
    expect(CURRENCY_ORDER).toEqual(["pp", "gp", "ep", "sp", "cp"]);
    expect(COIN_VALUE_CP).toEqual({ pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 });
  });
});
