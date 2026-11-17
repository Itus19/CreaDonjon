import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY_SYSTEM, type Currency, type CurrencySystem } from "@/src/core/rules/currency";
import { piecesAffichees } from "./monnaie";

/** V3.1-219 (ADR 0102) — les pièces que l'inventaire affiche, selon le système du monde. */
const empty: Currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
const avecCouronne: CurrencySystem = {
  coins: [...DEFAULT_CURRENCY_SYSTEM.coins, { key: "crown", label: { fr: "Couronne", en: "Crown" }, value_cp: 500, role: "common" }],
  break_order: ["ep", "pp"],
};

describe("piecesAffichees", () => {
  it("le système par défaut : les cinq pièces, abrégées, de la plus grosse à la plus petite", () => {
    expect(piecesAffichees({ ...empty, gp: 3 }, DEFAULT_CURRENCY_SYSTEM, "fr").map((p) => [p.key, p.abbr, p.amount, p.status])).toEqual([
      ["pp", "pp", 0, "known"],
      ["gp", "po", 3, "known"],
      ["ep", "pe", 0, "known"],
      ["sp", "pa", 0, "known"],
      ["cp", "pc", 0, "known"],
    ]);
  });

  it("une pièce maison du système s'insère à sa valeur, avec son libellé dans la langue", () => {
    const pieces = piecesAffichees({ ...empty, extra: { crown: 2 } }, avecCouronne, "en");
    expect(pieces.map((p) => p.key)).toEqual(["pp", "crown", "gp", "ep", "sp", "cp"]);
    expect(pieces[1]).toMatchObject({ abbr: "Crown", label: "Crown", amount: 2, status: "known" });
  });

  it("une pièce SRD hors système n'apparaît que si on en détient, signalée « hors système »", () => {
    const sansElectrum: CurrencySystem = { coins: DEFAULT_CURRENCY_SYSTEM.coins.filter((c) => c.key !== "ep"), break_order: ["pp"] };
    expect(piecesAffichees(empty, sansElectrum, "fr").map((p) => p.key)).toEqual(["pp", "gp", "sp", "cp"]);
    expect(piecesAffichees({ ...empty, ep: 2 }, sansElectrum, "fr").find((p) => p.key === "ep")).toMatchObject({ amount: 2, status: "outside" });
  });

  it("une pièce maison inconnue du système est affichée « inconnue », à la fin", () => {
    const pieces = piecesAffichees({ ...empty, extra: { zork: 4 } }, DEFAULT_CURRENCY_SYSTEM, "fr");
    expect(pieces.at(-1)).toMatchObject({ key: "zork", abbr: "zork", amount: 4, status: "unknown" });
  });
});
