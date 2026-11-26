import { describe, expect, it } from "vitest";
import { deriveSeed } from "./seed";

describe("deriveSeed", () => {
  it("rend toujours la même graine pour les mêmes entrées", () => {
    expect(deriveSeed(42, "auberge-1", "innkeeper", 0)).toBe(deriveSeed(42, "auberge-1", "innkeeper", 0));
  });

  it("rend un entier non signé de 32 bits", () => {
    const seed = deriveSeed(4_294_967_295, "x", 7);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it("change quand la graine parente, le lieu, le rôle ou le rang change", () => {
    const base = deriveSeed(42, "auberge-1", "staff", 0);
    expect(deriveSeed(43, "auberge-1", "staff", 0)).not.toBe(base);
    expect(deriveSeed(42, "auberge-2", "staff", 0)).not.toBe(base);
    expect(deriveSeed(42, "auberge-1", "patron", 0)).not.toBe(base);
    expect(deriveSeed(42, "auberge-1", "staff", 1)).not.toBe(base);
  });

  it("ne confond pas deux découpages qui collent les mêmes caractères", () => {
    expect(deriveSeed(1, "ab", "c")).not.toBe(deriveSeed(1, "a", "bc"));
  });

  it("refuse une graine parente hors de l'intervalle", () => {
    expect(() => deriveSeed(-1, "x")).toThrow(RangeError);
    expect(() => deriveSeed(2 ** 32, "x")).toThrow(RangeError);
    expect(() => deriveSeed(1.5, "x")).toThrow(RangeError);
  });
});
