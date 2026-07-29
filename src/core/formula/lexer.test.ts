import { describe, expect, it } from "vitest";
import { FormulaParseError } from "./errors";
import { tokenize } from "./lexer";

describe("tokenize", () => {
  it("reconnait un nombre simple", () => {
    expect(tokenize("42")).toEqual([{ type: "number", value: 42 }, { type: "eof" }]);
  });

  it("reconnait une notation de des simple", () => {
    expect(tokenize("2d6")).toEqual([
      { type: "dice", count: 2, faces: 6, keep: undefined },
      { type: "eof" },
    ]);
  });

  it("reconnait kh et kl", () => {
    expect(tokenize("4d6kh3")[0]).toEqual({
      type: "dice",
      count: 4,
      faces: 6,
      keep: { mode: "kh", count: 3 },
    });
    expect(tokenize("4d6kl1")[0]).toEqual({
      type: "dice",
      count: 4,
      faces: 6,
      keep: { mode: "kl", count: 1 },
    });
  });

  it("reconnait une reference entre accolades", () => {
    expect(tokenize("{STR_MOD}")).toEqual([{ type: "ref", name: "STR_MOD" }, { type: "eof" }]);
  });

  it("reconnait les operateurs, parentheses et virgule", () => {
    expect(tokenize("+-*/(),")).toEqual([
      { type: "+" },
      { type: "-" },
      { type: "*" },
      { type: "/" },
      { type: "(" },
      { type: ")" },
      { type: "," },
      { type: "eof" },
    ]);
  });

  it("reconnait un identifiant (nom de fonction)", () => {
    expect(tokenize("floor")).toEqual([{ type: "ident", name: "floor" }, { type: "eof" }]);
  });

  it("ignore les espaces", () => {
    expect(tokenize(" 2d6 + 3 ")).toEqual([
      { type: "dice", count: 2, faces: 6, keep: undefined },
      { type: "+" },
      { type: "number", value: 3 },
      { type: "eof" },
    ]);
  });

  it("leve une erreur sur une accolade non fermee", () => {
    expect(() => tokenize("{STR_MOD")).toThrow(FormulaParseError);
  });

  it("leve une erreur sur une reference vide", () => {
    expect(() => tokenize("{}")).toThrow(FormulaParseError);
  });

  it("leve une erreur si aucun chiffre ne suit kh/kl", () => {
    expect(() => tokenize("4d6kh")).toThrow(FormulaParseError);
  });

  it("leve une erreur sur un caractere inattendu", () => {
    expect(() => tokenize("2 & 3")).toThrow(FormulaParseError);
  });
});
