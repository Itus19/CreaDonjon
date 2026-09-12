import { describe, expect, it } from "vitest";
import { SeededRng } from "../dice/rng";
import { randomPoles, priorityFromPoles } from "./random";

describe("randomPoles", () => {
  it("genere une valeur par cle, bornee a [-60, 60]", () => {
    const rng = new SeededRng(42);
    const poles = randomPoles(["a", "b", "c"] as const, rng);
    expect(poles.map((p) => p.key)).toEqual(["a", "b", "c"]);
    for (const p of poles) {
      expect(p.value).toBeGreaterThanOrEqual(-60);
      expect(p.value).toBeLessThanOrEqual(60);
      expect(Number.isInteger(p.value)).toBe(true);
    }
  });

  it("est deterministe pour une graine donnee", () => {
    const poles1 = randomPoles(["a", "b"] as const, new SeededRng(7));
    const poles2 = randomPoles(["a", "b"] as const, new SeededRng(7));
    expect(poles1).toEqual(poles2);
  });
});

describe("priorityFromPoles", () => {
  it("retient les poles les plus marques en valeur absolue", () => {
    const poles = [
      { key: "low", value: 3 },
      { key: "high", value: -55 },
      { key: "mid", value: 20 },
    ];
    expect(priorityFromPoles(poles, 2)).toEqual(["high", "mid"]);
  });
});
