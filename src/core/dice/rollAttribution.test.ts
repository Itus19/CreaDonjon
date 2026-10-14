import { describe, expect, it } from "vitest";
import { naturalD20FromTrace, DICE_ROLL_KINDS } from "./rollAttribution";
import { resolveAttackRoll, resolveCheckRoll, resolveDamageRoll } from "../rules/action";
import { evaluate } from "../formula/evaluate";
import { parseFormula } from "../formula/parser";
import type { Rng } from "./rng";

/** Rend les faces données, dans l'ordre (une face = nextInt + 1). */
function faces(...values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++] - 1 };
}

describe("le d20 gardé (V3.1-89)", () => {
  it("jet simple : le d20 lancé", () => {
    const r = resolveCheckRoll({ modifier: 3, advantage: "normal" }, faces(14));
    expect(naturalD20FromTrace(r.trace)).toBe(14);
  });
  it("avantage : le plus haut des deux", () => {
    const r = resolveAttackRoll({ abilityMod: 2, proficiencyBonus: 2, proficient: true, advantage: "advantage" }, faces(4, 17));
    expect(naturalD20FromTrace(r.trace)).toBe(17);
  });
  it("désavantage : le plus bas des deux", () => {
    const r = resolveCheckRoll({ modifier: 0, advantage: "disadvantage" }, faces(19, 2));
    expect(naturalD20FromTrace(r.trace)).toBe(2);
  });
  it("jet libre : le d20 unique, même placé après un autre dé", () => {
    const { trace } = evaluate(parseFormula("1d4+1d20"), {}, faces(3, 20), "roll");
    expect(naturalD20FromTrace(trace)).toBe(20);
  });
  it("aucun d20, ou plusieurs d20 gardés : rien (on ne devine pas)", () => {
    expect(naturalD20FromTrace(resolveDamageRoll({ formula: "1d8", critical: false }, faces(5)).trace)).toBeUndefined();
    const { trace } = evaluate(parseFormula("2d20"), {}, faces(3, 9), "roll");
    expect(naturalD20FromTrace(trace)).toBeUndefined();
  });
  it("les sept natures de jet", () => {
    expect(DICE_ROLL_KINDS).toEqual(["attack", "damage", "check", "save", "spell", "heal", "free"]);
  });
});
