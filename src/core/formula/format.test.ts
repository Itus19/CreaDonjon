import { describe, expect, it } from "vitest";
import { formatFormulaNode } from "./format";
import { parseFormula } from "./parser";

describe("formatFormulaNode", () => {
  it("formate un nombre", () => {
    expect(formatFormulaNode({ op: "num", value: 5 })).toBe("5");
  });

  it("formate un de simple", () => {
    expect(formatFormulaNode({ op: "dice", count: 8, faces: 6 })).toBe("8d6");
  });

  it("formate un de avec conservation kh/kl", () => {
    expect(
      formatFormulaNode({ op: "dice", count: 4, faces: 6, keep: { mode: "kh", count: 3 } })
    ).toBe("4d6kh3");
  });

  it("formate une reference", () => {
    expect(formatFormulaNode({ op: "ref", name: "STR_MOD" })).toBe("{STR_MOD}");
  });

  it("formate une addition", () => {
    expect(
      formatFormulaNode({
        op: "add",
        args: [{ op: "num", value: 2 }, { op: "num", value: 3 }],
      })
    ).toBe("2 + 3");
  });

  it("parenthese les operandes de priorite plus faible", () => {
    // (2+3)*4 : l'addition doit etre parenthesee sous la multiplication,
    // sinon le texte reparse comme 2+3*4 (mul en premier), ce qui n'est
    // pas la meme formule.
    expect(
      formatFormulaNode({
        op: "mul",
        args: [
          { op: "add", args: [{ op: "num", value: 2 }, { op: "num", value: 3 }] },
          { op: "num", value: 4 },
        ],
      })
    ).toBe("(2 + 3) * 4");
  });

  it("formate min/max/floor/ceil/round en style fonctionnel", () => {
    expect(
      formatFormulaNode({ op: "min", args: [{ op: "num", value: 1 }, { op: "num", value: 2 }] })
    ).toBe("min(1, 2)");
    expect(
      formatFormulaNode({ op: "floor", args: [{ op: "num", value: 1.5 }] })
    ).toBe("floor(1.5)");
  });

  it("round-trip : le texte forme reparse vers le meme AST", () => {
    const ast = parseFormula("2d6+{STR_MOD}");
    expect(parseFormula(formatFormulaNode(ast))).toEqual(ast);
  });

  it("round-trip avec priorites melangees", () => {
    const ast = parseFormula("(2+3)*4-floor(1.5)");
    expect(parseFormula(formatFormulaNode(ast))).toEqual(ast);
  });
});
