import { describe, expect, it } from "vitest";
import { formatTableEntryPrice } from "./fr";

describe("formatTableEntryPrice", () => {
  it("absent pour une entree sans prix", () => {
    expect(formatTableEntryPrice(undefined)).toBeNull();
  });

  it("« Gratuit » pour un montant nul plutot que « 0 pc »", () => {
    expect(formatTableEntryPrice({ amount: 0, coin: "cp" })).toBe("Gratuit");
  });

  it("montant + abreviation francaise", () => {
    expect(formatTableEntryPrice({ amount: 4, coin: "cp" })).toBe("4 pc");
    expect(formatTableEntryPrice({ amount: 1, coin: "gp" })).toBe("1 po");
  });
});
