import { describe, expect, it } from "vitest";
import { parseBlockData } from "../schemas/rule-blocks/blocks";
import { applyCurrencyDelta, DEFAULT_CURRENCY_SYSTEM, depositCoins, spendCoins, totalValueCp, type Currency, type CurrencySystem } from "./currency";

/**
 * V3.1-217 (ADR 0102) — le système monétaire en paramètre. Sans système
 * fourni, le comportement est celui du 13 octobre (currency.test.ts, inchangé).
 * Ici : un système maison, ses pièces courantes, ses réserves, et les pièces
 * qu'un porte-monnaie détient sans que le système les connaisse.
 */
const empty: Currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
const coin = (key: string, value_cp: number, role: "common" | "reserve") => ({ key, label: { fr: key, en: key }, value_cp, role });

/** Le système SRD, plus une couronne courante de 5 po. */
const avecCouronne: CurrencySystem = {
  coins: [...DEFAULT_CURRENCY_SYSTEM.coins, coin("crown", 500, "common")],
  break_order: DEFAULT_CURRENCY_SYSTEM.break_order,
};

/** Une réserve maison (éclat de gemme, 2 po) cassée avant le platine et l'électrum. */
const avecEclat: CurrencySystem = {
  coins: [...DEFAULT_CURRENCY_SYSTEM.coins, coin("gem_shard", 200, "reserve")],
  break_order: ["gem_shard", "pp", "ep"],
};

/** Un monde sans électrum. */
const sansElectrum: CurrencySystem = {
  coins: DEFAULT_CURRENCY_SYSTEM.coins.filter((c) => c.key !== "ep"),
  break_order: ["pp"],
};

describe("DEFAULT_CURRENCY_SYSTEM", () => {
  it("est le système du 13 octobre : or, argent, cuivre courants ; électrum puis platine en réserve", () => {
    expect(DEFAULT_CURRENCY_SYSTEM.coins.map((c) => [c.key, c.value_cp, c.role])).toEqual([
      ["pp", 1000, "reserve"],
      ["gp", 100, "common"],
      ["ep", 50, "reserve"],
      ["sp", 10, "common"],
      ["cp", 1, "common"],
    ]);
    expect(DEFAULT_CURRENCY_SYSTEM.break_order).toEqual(["ep", "pp"]);
  });

  it("passe son propre schéma de bloc", () => {
    expect(parseBlockData("currency_system", DEFAULT_CURRENCY_SYSTEM).ok).toBe(true);
  });
});

describe("le bloc currency_system", () => {
  it("refuse deux pièces de même clé", () => {
    expect(parseBlockData("currency_system", { ...avecCouronne, coins: [...avecCouronne.coins, coin("crown", 300, "common")] }).ok).toBe(false);
  });

  it("refuse un système sans pièce de valeur 1 (un total ne se rendrait pas)", () => {
    expect(parseBlockData("currency_system", { coins: [coin("gp", 100, "common")], break_order: [] }).ok).toBe(false);
  });

  it("refuse un système sans pièce courante", () => {
    expect(parseBlockData("currency_system", { coins: [coin("cp", 1, "reserve")], break_order: [] }).ok).toBe(false);
  });

  it("refuse un ordre de casse qui cite une pièce courante ou inconnue", () => {
    expect(parseBlockData("currency_system", { ...DEFAULT_CURRENCY_SYSTEM, break_order: ["gp"] }).ok).toBe(false);
    expect(parseBlockData("currency_system", { ...DEFAULT_CURRENCY_SYSTEM, break_order: ["zork"] }).ok).toBe(false);
  });

  it("refuse une clé hors snake_case et une valeur non entière", () => {
    expect(parseBlockData("currency_system", { ...avecCouronne, coins: [...DEFAULT_CURRENCY_SYSTEM.coins, coin("Couronne", 500, "common")] }).ok).toBe(false);
    expect(parseBlockData("currency_system", { ...avecCouronne, coins: [...DEFAULT_CURRENCY_SYSTEM.coins, coin("crown", 2.5, "common")] }).ok).toBe(false);
  });

  it("accepte une pièce maison courante et une réserve maison", () => {
    expect(parseBlockData("currency_system", avecCouronne).ok).toBe(true);
    expect(parseBlockData("currency_system", avecEclat).ok).toBe(true);
  });
});

describe("une pièce maison courante", () => {
  it("se forme au dépôt : 6 po deviennent 1 couronne et 1 po", () => {
    expect(depositCoins(empty, "gp", 6, avecCouronne)).toEqual({ ...empty, gp: 1, extra: { crown: 1 } });
  });

  it("se dépose et se regroupe comme l'or", () => {
    expect(depositCoins({ ...empty, gp: 4 }, "crown", 1, avecCouronne)).toEqual({ ...empty, gp: 4, extra: { crown: 1 } });
  });

  it("se dépense en rendant la monnaie", () => {
    expect(spendCoins({ ...empty, gp: 7 }, "crown", 1, avecCouronne)).toEqual({ ...empty, gp: 2 });
  });

  it("compte dans le total", () => {
    expect(totalValueCp({ ...empty, gp: 1, extra: { crown: 2 } }, avecCouronne)).toBe(1100);
  });

  it("passe par applyCurrencyDelta (10 po se regroupent en 2 couronnes ; il en reste une)", () => {
    expect(applyCurrencyDelta({ ...empty, gp: 10 }, { crown: -1, cp: 3 }, avecCouronne)).toEqual({ ...empty, cp: 3, extra: { crown: 1 } });
  });
});

describe("une réserve maison", () => {
  it("n'est pas formée au dépôt, mais gardée", () => {
    expect(depositCoins({ ...empty, gp: 30 }, "gem_shard", 2, avecEclat)).toEqual({ ...empty, gp: 30, extra: { gem_shard: 2 } });
  });

  it("se casse dans l'ordre donné : l'éclat avant le platine et l'électrum", () => {
    expect(spendCoins({ ...empty, pp: 1, ep: 1, extra: { gem_shard: 1 } }, "gp", 1, avecEclat)).toEqual({ ...empty, pp: 1, ep: 1, gp: 1 });
  });

  it("disparaît du porte-monnaie quand elle tombe à zéro", () => {
    expect(spendCoins({ ...empty, extra: { gem_shard: 1 } }, "gem_shard", 1, avecEclat)).toEqual(empty);
  });
});

describe("une pièce que le système ne connaît pas", () => {
  it("une pièce SRD absente compte à sa valeur standard", () => {
    expect(totalValueCp({ ...empty, ep: 2 }, sansElectrum)).toBe(100);
  });

  it("une pièce SRD absente n'est plus formée : déposée, elle est gardée telle quelle", () => {
    expect(depositCoins({ ...empty, sp: 3 }, "ep", 1, sansElectrum)).toEqual({ ...empty, sp: 3, ep: 1 });
  });

  it("une pièce SRD absente se casse en dernier recours", () => {
    expect(spendCoins({ ...empty, ep: 2, gp: 1 }, "gp", 2, sansElectrum)).toEqual(empty);
  });

  it("une pièce maison absente compte à 0, reste affichée, et ne paie jamais rien", () => {
    const bourse: Currency = { ...empty, gp: 1, extra: { zork: 5 } };
    expect(totalValueCp(bourse)).toBe(100);
    expect(spendCoins(bourse, "gp", 2)).toBeNull();
    expect(spendCoins(bourse, "gp", 1)).toEqual({ ...empty, extra: { zork: 5 } });
  });

  it("dépenser une pièce maison inconnue ne prend que celles qu'on détient", () => {
    expect(spendCoins({ ...empty, gp: 9, extra: { zork: 1 } }, "zork", 2)).toBeNull();
    expect(spendCoins({ ...empty, gp: 9, extra: { zork: 3 } }, "zork", 2)).toEqual({ ...empty, gp: 9, extra: { zork: 1 } });
  });
});
