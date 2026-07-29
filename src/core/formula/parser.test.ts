import { describe, expect, it } from "vitest";
import { FormulaLimitError, FormulaParseError } from "./errors";
import { parseFormula } from "./parser";

describe("parseFormula", () => {
  it("parse un nombre", () => {
    expect(parseFormula("5")).toEqual({ op: "num", value: 5 });
  });

  it("parse une addition et respecte la priorite des operateurs", () => {
    expect(parseFormula("2+3*4")).toEqual({
      op: "add",
      args: [
        { op: "num", value: 2 },
        { op: "mul", args: [{ op: "num", value: 3 }, { op: "num", value: 4 }] },
      ],
    });
  });

  it("les parentheses changent la priorite", () => {
    expect(parseFormula("(2+3)*4")).toEqual({
      op: "mul",
      args: [
        { op: "add", args: [{ op: "num", value: 2 }, { op: "num", value: 3 }] },
        { op: "num", value: 4 },
      ],
    });
  });

  it("parse un noeud de", () => {
    expect(parseFormula("2d6")).toEqual({ op: "dice", count: 2, faces: 6, keep: undefined });
  });

  it("parse 4d6kh3", () => {
    expect(parseFormula("4d6kh3")).toEqual({
      op: "dice",
      count: 4,
      faces: 6,
      keep: { mode: "kh", count: 3 },
    });
  });

  it("parse une reference", () => {
    expect(parseFormula("{STR_MOD}")).toEqual({ op: "ref", name: "STR_MOD" });
  });

  it("parse une formule complete avec dice et reference", () => {
    expect(parseFormula("2d6+{STR_MOD}")).toEqual({
      op: "add",
      args: [
        { op: "dice", count: 2, faces: 6, keep: undefined },
        { op: "ref", name: "STR_MOD" },
      ],
    });
  });

  it("parse floor/ceil/round a un argument", () => {
    expect(parseFormula("floor(1.5)")).toEqual({ op: "floor", args: [{ op: "num", value: 1.5 }] });
    expect(parseFormula("ceil(1.5)")).toEqual({ op: "ceil", args: [{ op: "num", value: 1.5 }] });
    expect(parseFormula("round(1.5)")).toEqual({ op: "round", args: [{ op: "num", value: 1.5 }] });
  });

  it("parse min/max avec plusieurs arguments", () => {
    expect(parseFormula("min(1,2,3)")).toEqual({
      op: "min",
      args: [{ op: "num", value: 1 }, { op: "num", value: 2 }, { op: "num", value: 3 }],
    });
    expect(parseFormula("max(1,2)")).toEqual({
      op: "max",
      args: [{ op: "num", value: 1 }, { op: "num", value: 2 }],
    });
  });

  it("rejette un jeton final inattendu", () => {
    expect(() => parseFormula("2 3")).toThrow(FormulaParseError);
  });

  it("rejette un facteur absent (operateur en tete d'expression)", () => {
    expect(() => parseFormula("*3")).toThrow(FormulaParseError);
  });

  it("rejette une fonction inconnue", () => {
    expect(() => parseFormula("sqrt(4)")).toThrow(FormulaParseError);
  });

  it("rejette floor() avec zero ou plusieurs arguments", () => {
    expect(() => parseFormula("floor(1,2)")).toThrow(FormulaParseError);
  });

  it("rejette une parenthese non fermee", () => {
    expect(() => parseFormula("(2+3")).toThrow(FormulaParseError);
  });

  it("rejette kh avec un compte superieur au nombre de des", () => {
    expect(() => parseFormula("2d6kh3")).toThrow(FormulaParseError);
  });

  it("rejette kh0", () => {
    expect(() => parseFormula("2d6kh0")).toThrow(FormulaParseError);
  });

  it("9999999d6 est refuse par la limite, en moins de 10 ms", () => {
    const start = performance.now();
    expect(() => parseFormula("9999999d6")).toThrow(FormulaLimitError);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it("refuse un nombre de faces au-dela de la limite", () => {
    expect(() => parseFormula("1d99999999")).toThrow(FormulaLimitError);
  });

  it("refuse une profondeur de parentheses excessive", () => {
    const deep = "(".repeat(40) + "1" + ")".repeat(40);
    expect(() => parseFormula(deep)).toThrow(FormulaLimitError);
  });

  it("refuse un nombre de noeuds excessif", () => {
    const long = Array.from({ length: 600 }, () => "1").join("+");
    expect(() => parseFormula(long)).toThrow(FormulaLimitError);
  });
});
