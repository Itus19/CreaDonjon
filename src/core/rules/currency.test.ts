import { describe, expect, it } from "vitest";
import { applyCurrencyDelta, COIN_VALUE_CP, CURRENCY_ORDER, depositCoins, spendCoins, type Currency } from "./currency";

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

  it("recompose tout le porte-monnaie, pas seulement le type depose, sans former d'electrum", () => {
    // 23 pa = 230 pc. Deposer 2 pa (250 pc) recompose en 2 po + 5 pa : jamais
    // de pe (decision du 4 octobre, ADR 0036 §1).
    const currency: Currency = { ...empty, sp: 23 };
    expect(depositCoins(currency, "sp", 2)).toEqual({ ...empty, gp: 2, sp: 5 });
  });

  it("ajouter 5 pa a 0 pa ne forme pas d'electrum", () => {
    expect(depositCoins(empty, "sp", 5)).toEqual({ ...empty, sp: 5 });
  });

  it("l'electrum detenu reste tel quel apres un depot d'une autre piece", () => {
    expect(depositCoins({ ...empty, ep: 2 }, "gp", 3)).toEqual({ ...empty, ep: 2, gp: 3 });
  });

  it("deposer de l'electrum l'ajoute aux pe detenues", () => {
    expect(depositCoins({ ...empty, ep: 2, sp: 4 }, "ep", 3)).toEqual({ ...empty, ep: 5, sp: 4 });
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

  it("recompose du plus gros au plus petit, sans jamais former d'electrum", () => {
    // 25 pa (250 pc) + 3 pc = 253 pc. Retirer 3 pc laisse 250 pc : 2 po + 5 pa.
    const currency: Currency = { ...empty, sp: 25, cp: 3 };
    expect(spendCoins(currency, "cp", 3)).toEqual({ ...empty, gp: 2, sp: 5 });
  });

  it("depenser 3 po avec 1 pp et 0 po rend la monnaie", () => {
    expect(spendCoins({ ...empty, pp: 1 }, "gp", 3)).toEqual({ ...empty, gp: 7 });
  });

  it("l'electrum detenu n'est pas casse tant que le reste suffit", () => {
    expect(spendCoins({ ...empty, ep: 2, gp: 5 }, "gp", 3)).toEqual({ ...empty, ep: 2, gp: 2 });
  });

  it("l'electrum se casse en dernier recours, et ce qui n'est pas consomme reste en pe", () => {
    // 2 pe (100 pc) + 1 po (100 pc) = 200 pc. Retirer 130 pc : le reste (1 po)
    // ne suffit pas, on entame l'electrum ; il reste 70 pc = 1 pe + 2 pa.
    expect(spendCoins({ ...empty, ep: 2, gp: 1 }, "cp", 130)).toEqual({ ...empty, ep: 1, sp: 2 });
  });

  it("depenser de l'electrum consomme d'abord les pe detenues", () => {
    expect(spendCoins({ ...empty, ep: 2, gp: 5 }, "ep", 1)).toEqual({ ...empty, ep: 1, gp: 5 });
  });

  it("refuse sans rien modifier quand l'electrum compris ne suffit pas", () => {
    expect(spendCoins({ ...empty, ep: 1, gp: 1 }, "gp", 2)).toBeNull();
  });
});

describe("applyCurrencyDelta", () => {
  it("applique un delta par piece : depot et depense ensemble", () => {
    expect(applyCurrencyDelta({ ...empty, pp: 1 }, { gp: -3, cp: 4 })).toEqual({ ...empty, gp: 7, cp: 4 });
  });

  it("refuse (null) quand le total ne suffit pas", () => {
    expect(applyCurrencyDelta({ ...empty, gp: 2 }, { gp: -3 })).toBeNull();
  });

  it("un delta vide ne change rien", () => {
    expect(applyCurrencyDelta({ ...empty, gp: 2, ep: 1 }, {})).toEqual({ ...empty, gp: 2, ep: 1 });
  });
});

describe("CURRENCY_ORDER / COIN_VALUE_CP", () => {
  it("va du plus gros au plus petit et suit le taux d'echange standard", () => {
    expect(CURRENCY_ORDER).toEqual(["pp", "gp", "ep", "sp", "cp"]);
    expect(COIN_VALUE_CP).toEqual({ pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 });
  });
});
