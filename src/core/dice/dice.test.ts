import { describe, expect, it } from "vitest";
import { SeededRng } from "./rng";
import { averageDiceValue, extremeDice, rollDice } from "./roll";

describe("SeededRng", () => {
  it("est deterministe : la meme graine produit la meme sequence", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(20));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(20));
    expect(seqA).toEqual(seqB);
  });

  it("deux graines differentes produisent des sequences differentes", () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(1000));
    expect(seqA).not.toEqual(seqB);
  });

  it("respecte toujours les bornes [0, maxExclusive)", () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = rng.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it("rejette un maxExclusive invalide", () => {
    const rng = new SeededRng(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });
});

describe("rollDice", () => {
  it("lance le bon nombre de des dans les bonnes faces", () => {
    const rng = new SeededRng(5);
    const result = rollDice(4, 6, rng);
    expect(result.rolls).toHaveLength(4);
    for (const r of result.rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
    expect(result.total).toBe(result.rolls.reduce((a, b) => a + b, 0));
  });

  it("garde les 3 meilleurs de 4d6 (kh3)", () => {
    const sequence = [1, 5, 2, 0]; // nextInt(6) -> +1 = 2, 6, 3, 1
    let i = 0;
    const rng = { nextInt: () => sequence[i++] };
    const result = rollDice(4, 6, rng, { mode: "kh", count: 3 });
    expect(result.rolls).toEqual([2, 6, 3, 1]);
    expect(result.keptRolls.slice().sort((a, b) => b - a)).toEqual([6, 3, 2]);
    expect(result.total).toBe(11);
  });

  it("garde les 2 pires avec kl", () => {
    const sequence = [1, 5, 2, 0]; // -> 2, 6, 3, 1
    let i = 0;
    const rng = { nextInt: () => sequence[i++] };
    const result = rollDice(4, 6, rng, { mode: "kl", count: 2 });
    expect(result.keptRolls.slice().sort((a, b) => a - b)).toEqual([1, 2]);
    expect(result.total).toBe(3);
  });
});

describe("extremeDice", () => {
  it("min met chaque de a 1", () => {
    const result = extremeDice(4, 6, "min");
    expect(result.rolls).toEqual([1, 1, 1, 1]);
    expect(result.total).toBe(4);
  });

  it("max met chaque de a sa face maximale", () => {
    const result = extremeDice(3, 8, "max");
    expect(result.rolls).toEqual([8, 8, 8]);
    expect(result.total).toBe(24);
  });

  it("applique kh/kl aussi sur les valeurs extremes", () => {
    const result = extremeDice(4, 6, "max", { mode: "kh", count: 3 });
    expect(result.total).toBe(18);
  });
});

describe("averageDiceValue", () => {
  it("2d6 a une moyenne de 7", () => {
    expect(averageDiceValue(2, 6)).toBe(7);
  });

  it("1d20 a une moyenne de 10.5", () => {
    expect(averageDiceValue(1, 20)).toBe(10.5);
  });

  it("applique une approximation documentee avec kh/kl", () => {
    expect(averageDiceValue(4, 6, { mode: "kh", count: 3 })).toBe(3 * 3.5);
  });
});
