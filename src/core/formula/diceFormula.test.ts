import { describe, expect, it } from "vitest";
import { parseFormula } from "./parser";
import { formatFormulaNode } from "./format";
import { evaluate } from "./evaluate";
import { zFormulaNode } from "../schemas/rule-blocks/primitives";
import type { Rng } from "../dice/rng";

/**
 * V3.1-155 (ADR 0074) — le nombre et la taille des dés en formule :
 * `ceil({class.level} / 2)d6` (Attaque sournoise), `{proficiency}d10`,
 * `1d{column.x}` (dé d'inspiration). L'écriture `2d6` ne change pas.
 */

const max: Rng = { nextInt: (n: number) => n - 1 };

describe("les dés en formule", () => {
  it("se lisent derrière une fonction, une référence ou une parenthèse", () => {
    expect(parseFormula("ceil({class.level} / 2)d6")).toEqual({
      op: "dice",
      count: { op: "ceil", args: [{ op: "div", args: [{ op: "ref", name: "class.level" }, { op: "num", value: 2 }] }] },
      faces: 6,
    });
    expect(parseFormula("{proficiency}d10")).toEqual({ op: "dice", count: { op: "ref", name: "proficiency" }, faces: 10 });
    expect(parseFormula("1d{column.die}")).toEqual({ op: "dice", count: 1, faces: { op: "ref", name: "column.die" } });
    expect(parseFormula("({level} + 1)d(2 * 3)")).toEqual({
      op: "dice",
      count: { op: "add", args: [{ op: "ref", name: "level" }, { op: "num", value: 1 }] },
      faces: { op: "mul", args: [{ op: "num", value: 2 }, { op: "num", value: 3 }] },
    });
  });

  it("l'écriture fixe ne change pas", () => {
    expect(parseFormula("2d6 + 3")).toEqual({ op: "add", args: [{ op: "dice", count: 2, faces: 6 }, { op: "num", value: 3 }] });
  });

  it("s'évalue aux bornes du niveau", () => {
    const n = parseFormula("ceil({class.level} / 2)d6");
    expect(evaluate(n, { "class.level": 5 }, max, "max").value).toBe(18);
    expect(evaluate(n, { "class.level": 1 }, max, "min").value).toBe(1);
    expect(evaluate(parseFormula("1d{column.die}"), { "column.die": 8 }, max, "average").value).toBe(4.5);
    expect(evaluate(parseFormula("1d{column.die}"), { "column.die": 8 }, max, "roll").value).toBe(8);
  });

  it("l'aller-retour texte → arbre → texte est exact", () => {
    for (const t of ["ceil({class.level} / 2)d6", "{proficiency}d10", "1d{column.die}", "({level} + 1)d(2 * 3)", "2d6kh1 + 3"]) {
      expect(parseFormula(formatFormulaNode(parseFormula(t)))).toEqual(parseFormula(t));
    }
  });

  it("refuse un dé dans le nombre de dés, et une taille hors bornes à l'évaluation", () => {
    expect(() => parseFormula("(1d4)d6")).toThrow();
    expect(() => evaluate(parseFormula("1d{f}"), { f: 0 }, max, "roll")).toThrow();
  });

  it("Zod accepte la forme en formule et refuse un nombre de dés négatif", () => {
    expect(zFormulaNode.safeParse(parseFormula("ceil({class.level} / 2)d6")).success).toBe(true);
    expect(zFormulaNode.safeParse({ op: "dice", count: -1, faces: 6 }).success).toBe(false);
  });
});
