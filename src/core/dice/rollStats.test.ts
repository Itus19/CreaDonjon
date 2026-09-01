import { describe, expect, it } from "vitest";
import { computeDiceStats, type DiceStatsInput } from "./rollStats";

function check(result: number, d20Rolls: number[], verdict: "success" | "fail" | null = null): DiceStatsInput {
  return { result, diceGroups: [{ faces: 20, rolls: d20Rolls }], verdict };
}

describe("computeDiceStats", () => {
  it("ne compte que les jets qui incluent un d20 — jamais un jet de degats pur (2d6+3)", () => {
    const rolls: DiceStatsInput[] = [check(15, [15]), { result: 9, diceGroups: [{ faces: 6, rolls: [3, 4] }], verdict: null }];
    expect(computeDiceStats(rolls).totalChecks).toBe(1);
  });

  it("moyenne des totaux (apres modificateurs), pas des des bruts", () => {
    const rolls = [check(15, [10]), check(21, [16])];
    expect(computeDiceStats(rolls).averageTotal).toBe(18);
  });

  it("averageTotal est null sans aucun jet d20 — jamais 0, qui laisserait croire a une vraie moyenne", () => {
    expect(computeDiceStats([]).averageTotal).toBeNull();
  });

  it("compte un 20 naturel des qu'un des d20 du jet affiche 20 — y compris en avantage (deux d20)", () => {
    const rolls = [check(20, [3, 20]), check(25, [20])];
    expect(computeDiceStats(rolls).natural20Count).toBe(2);
  });

  it("compte un 1 naturel des qu'un des d20 du jet affiche 1", () => {
    const rolls = [check(4, [1, 12]), check(1, [1])];
    expect(computeDiceStats(rolls).natural1Count).toBe(2);
  });

  it("un jet avec kh1/kl1 qui n'affiche NI 20 NI 1 ne compte dans aucun des deux", () => {
    const rolls = [check(14, [8, 14])];
    const stats = computeDiceStats(rolls);
    expect(stats.natural20Count).toBe(0);
    expect(stats.natural1Count).toBe(0);
  });

  it("reussite/echec ne comptent que les jets avec un verdict — jamais un jet sans DD", () => {
    const rolls = [check(15, [15], "success"), check(8, [8], "fail"), check(12, [12], null)];
    const stats = computeDiceStats(rolls);
    expect(stats.successCount).toBe(1);
    expect(stats.failCount).toBe(1);
    expect(stats.totalChecks).toBe(3);
  });
});
