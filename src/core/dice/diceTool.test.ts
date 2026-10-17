import { describe, expect, it } from "vitest";
import { advantagePairFromTrace, buildToolFormula, toolVerdict, verdictTone } from "./diceTool";
import { evaluate } from "../formula/evaluate";
import { parseFormula } from "../formula/parser";
import type { Rng } from "./rng";

/** Rend les faces données, dans l'ordre (une face = nextInt + 1). */
function faces(...values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++] - 1 };
}

function lancer(formula: string, rng: Rng) {
  return evaluate(parseFormula(formula), {}, rng, "roll");
}

describe("formule de l'outil de dés (V3.1-33)", () => {
  it("dés empilés, d20 d'abord, modificateur à la fin", () => {
    expect(buildToolFormula({ pool: { d6: 2, d20: 1 }, modifier: 3, advantage: "normal" })).toEqual({ ok: true, formula: "1d20+2d6+3" });
  });
  it("modificateur négatif, ou nul : jamais « +0 »", () => {
    expect(buildToolFormula({ pool: { d4: 1 }, modifier: -2, advantage: "normal" })).toEqual({ ok: true, formula: "1d4-2" });
    expect(buildToolFormula({ pool: { d4: 1 }, modifier: 0, advantage: "normal" })).toEqual({ ok: true, formula: "1d4" });
  });
  it("avantage et désavantage : le d20 devient deux d20, un seul gardé", () => {
    expect(buildToolFormula({ pool: { d20: 1 }, modifier: 5, advantage: "advantage" })).toEqual({ ok: true, formula: "2d20kh1+5" });
    expect(buildToolFormula({ pool: { d20: 1, d4: 1 }, modifier: 0, advantage: "disadvantage" })).toEqual({ ok: true, formula: "2d20kl1+1d4" });
  });
  it("avantage sans exactement un d20 : refusé, jamais deviné", () => {
    expect(buildToolFormula({ pool: { d6: 1 }, modifier: 0, advantage: "advantage" })).toEqual({ ok: false, reason: "advantage_needs_one_d20" });
    expect(buildToolFormula({ pool: { d20: 2 }, modifier: 0, advantage: "advantage" })).toEqual({ ok: false, reason: "advantage_needs_one_d20" });
  });
  it("aucun dé : refusé", () => {
    expect(buildToolFormula({ pool: { d6: 0 }, modifier: 4, advantage: "normal" })).toEqual({ ok: false, reason: "empty_pool" });
  });
  it("la formule rendue se lit et se lance", () => {
    const built = buildToolFormula({ pool: { d20: 1, d6: 1 }, modifier: -1, advantage: "normal" });
    if (!built.ok) throw new Error("formule refusée");
    expect(lancer(built.formula, faces(12, 4)).value).toBe(15);
  });
});

describe("la paire de d20 d'un jet avec avantage", () => {
  it("avantage : les deux dés, le plus haut gardé", () => {
    const { trace } = lancer("2d20kh1+5", faces(4, 17));
    expect(advantagePairFromTrace(trace)).toEqual({ mode: "advantage", rolls: [4, 17], keptIndex: 1 });
  });
  it("désavantage : le plus bas gardé", () => {
    const { trace } = lancer("2d20kl1", faces(19, 2));
    expect(advantagePairFromTrace(trace)).toEqual({ mode: "disadvantage", rolls: [19, 2], keptIndex: 1 });
  });
  it("égalité : le premier est gardé", () => {
    const { trace } = lancer("2d20kh1", faces(9, 9));
    expect(advantagePairFromTrace(trace)?.keptIndex).toBe(0);
  });
  it("sans avantage : rien", () => {
    expect(advantagePairFromTrace(lancer("1d20+3", faces(11)).trace)).toBeNull();
    expect(advantagePairFromTrace(undefined)).toBeNull();
  });
});

describe("verdict d'un jet de l'outil", () => {
  it("seulement contre un DD, et seulement s'il y a un d20", () => {
    expect(toolVerdict({ total: 14, dc: 12, hasD20: true })).toBe("success");
    expect(toolVerdict({ total: 11, dc: 12, hasD20: true })).toBe("fail");
    expect(toolVerdict({ total: 14, dc: null, hasD20: true })).toBeNull();
    expect(toolVerdict({ total: 14, dc: 12, hasD20: false })).toBeNull();
  });
  it("teinte : or sur une réussite au 20 naturel, sinon la couleur du verdict", () => {
    expect(verdictTone("success", 20)).toBe("critical");
    expect(verdictTone("success", 13)).toBe("success");
    expect(verdictTone("fail", 20)).toBe("fail");
    expect(verdictTone("fail", 1)).toBe("fail");
    expect(verdictTone(null, 20)).toBeNull();
  });
});
