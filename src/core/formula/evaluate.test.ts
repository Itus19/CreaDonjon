import { describe, expect, it } from "vitest";
import { SeededRng } from "../dice/rng";
import { UnknownReferenceError } from "./errors";
import { evaluate, formatTrace } from "./evaluate";
import { parseFormula } from "./parser";

describe("evaluate — reproductibilite", () => {
  it("2d6+{STR_MOD} redonne exactement le meme resultat avec la meme graine", () => {
    const ast = parseFormula("2d6+{STR_MOD}");
    const ctx = { STR_MOD: 3 };
    const a = evaluate(ast, ctx, new SeededRng(123), "roll");
    const b = evaluate(ast, ctx, new SeededRng(123), "roll");
    expect(a.value).toBe(b.value);
    expect(a.trace).toEqual(b.trace);
  });

  it("deux graines differentes peuvent donner des resultats differents", () => {
    const ast = parseFormula("10d20");
    const a = evaluate(ast, {}, new SeededRng(1), "roll");
    const b = evaluate(ast, {}, new SeededRng(2), "roll");
    expect(a.value).not.toBe(b.value);
  });
});

describe("evaluate — mode average", () => {
  it("retourne 7 + STR_MOD pour 2d6+{STR_MOD} sans consommer le RNG", () => {
    const ast = parseFormula("2d6+{STR_MOD}");
    const ctx = { STR_MOD: 3 };
    let calls = 0;
    const rng = { nextInt: () => { calls++; return 0; } };
    const result = evaluate(ast, ctx, rng, "average");
    expect(result.value).toBe(10);
    expect(calls).toBe(0);
  });

  it("ne consomme pas le RNG meme pour une formule sans reference", () => {
    const ast = parseFormula("4d6kh3");
    let calls = 0;
    const rng = { nextInt: () => { calls++; return 0; } };
    evaluate(ast, {}, rng, "average");
    expect(calls).toBe(0);
  });
});

describe("evaluate — modes min et max", () => {
  it("le mode min met chaque de a 1", () => {
    const ast = parseFormula("3d6+4");
    const rng = { nextInt: () => { throw new Error("le RNG ne doit pas etre appele en mode min"); } };
    const result = evaluate(ast, {}, rng, "min");
    expect(result.value).toBe(7); // 3*1 + 4
  });

  it("le mode max met chaque de a sa face maximale", () => {
    const ast = parseFormula("3d6+4");
    const rng = { nextInt: () => { throw new Error("le RNG ne doit pas etre appele en mode max"); } };
    const result = evaluate(ast, {}, rng, "max");
    expect(result.value).toBe(22); // 3*6 + 4
  });
});

describe("evaluate — 4d6kh3", () => {
  it("garde les 3 meilleurs des 4 lances", () => {
    const ast = parseFormula("4d6kh3");
    const sequence = [0, 5, 2, 3]; // nextInt(6) -> +1 = 1, 6, 3, 4 ; kh3 garde 6,4,3 = 13
    let i = 0;
    const rng = { nextInt: () => sequence[i++] };
    const result = evaluate(ast, {}, rng, "roll");
    expect(result.value).toBe(13);
  });
});

describe("evaluate — references", () => {
  it("une reference inconnue leve une erreur typee, jamais 0", () => {
    const ast = parseFormula("{UNKNOWN}");
    expect(() => evaluate(ast, {}, new SeededRng(1), "roll")).toThrow(UnknownReferenceError);
  });

  it("une reference presente dans le contexte est utilisee telle quelle", () => {
    const ast = parseFormula("{LEVEL}*2");
    const result = evaluate(ast, { LEVEL: 5 }, new SeededRng(1), "roll");
    expect(result.value).toBe(10);
  });
});

describe("evaluate — operateurs arithmetiques", () => {
  it("addition, soustraction, multiplication, division", () => {
    expect(evaluate(parseFormula("2+3"), {}, new SeededRng(1), "roll").value).toBe(5);
    expect(evaluate(parseFormula("5-2"), {}, new SeededRng(1), "roll").value).toBe(3);
    expect(evaluate(parseFormula("4*3"), {}, new SeededRng(1), "roll").value).toBe(12);
    expect(evaluate(parseFormula("10/4"), {}, new SeededRng(1), "roll").value).toBe(2.5);
  });

  it("la division par zero leve une erreur", () => {
    const ast = parseFormula("5/0");
    expect(() => evaluate(ast, {}, new SeededRng(1), "roll")).toThrow(RangeError);
  });
});

describe("evaluate — fonctions", () => {
  it("floor, ceil, round", () => {
    expect(evaluate(parseFormula("floor(1.7)"), {}, new SeededRng(1), "roll").value).toBe(1);
    expect(evaluate(parseFormula("ceil(1.2)"), {}, new SeededRng(1), "roll").value).toBe(2);
    expect(evaluate(parseFormula("round(1.5)"), {}, new SeededRng(1), "roll").value).toBe(2);
  });

  it("min et max avec plusieurs arguments", () => {
    expect(evaluate(parseFormula("min(3,1,2)"), {}, new SeededRng(1), "roll").value).toBe(1);
    expect(evaluate(parseFormula("max(3,1,2)"), {}, new SeededRng(1), "roll").value).toBe(3);
  });
});

describe("evaluate — trace", () => {
  it("la trace de 2d6+3 avec tirages 3 et 5 contient 3, 5, 8 et 11", () => {
    const ast = parseFormula("2d6+3");
    const sequence = [2, 4]; // nextInt(6) -> +1 = 3, 5
    let i = 0;
    const rng = { nextInt: () => sequence[i++] };
    const result = evaluate(ast, {}, rng, "roll");
    const text = formatTrace(result.trace);

    expect(text).toContain("3");
    expect(text).toContain("5");
    expect(text).toContain("8");
    expect(text).toContain("11");
    expect(result.value).toBe(11);
  });

  it("formatTrace joint les etapes de maniere lisible", () => {
    expect(formatTrace([{ text: "a", value: 1 }, { text: "b", value: 2 }])).toBe("a ; b");
    expect(formatTrace([])).toBe("");
  });
});
