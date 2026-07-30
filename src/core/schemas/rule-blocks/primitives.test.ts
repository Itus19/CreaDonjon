import { describe, expect, it } from "vitest";
import { zFormulaNode, zGrant, zLocalized, zQuantity } from "./primitives";

describe("zQuantity", () => {
  it("accepte une valeur et une unite", () => {
    expect(zQuantity.parse({ value: 90, unit: "feet" })).toEqual({ value: 90, unit: "feet" });
  });

  it("refuse une unite manquante", () => {
    expect(() => zQuantity.parse({ value: 90 })).toThrow();
  });
});

describe("zFormulaNode", () => {
  it("accepte un noeud simple", () => {
    expect(zFormulaNode.parse({ op: "num", value: 3 })).toEqual({ op: "num", value: 3 });
  });

  it("accepte un noeud recursif (add de deux des)", () => {
    const node = {
      op: "add",
      args: [
        { op: "dice", count: 2, faces: 6 },
        { op: "ref", name: "STR_MOD" },
      ],
    };
    expect(zFormulaNode.parse(node)).toEqual(node);
  });

  it("refuse un op inconnu", () => {
    expect(() => zFormulaNode.parse({ op: "eval", value: 1 })).toThrow();
  });
});

describe("zGrant", () => {
  it("accepte un grant de feature", () => {
    expect(zGrant.parse({ feature: "rage" })).toEqual({ feature: "rage" });
  });
});

describe("zLocalized", () => {
  it("accepte un enregistrement de libelles par locale", () => {
    expect(zLocalized.parse({ fr: "Rage", en: "Rage" })).toEqual({ fr: "Rage", en: "Rage" });
  });
});
