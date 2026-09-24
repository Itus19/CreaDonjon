import { describe, expect, it } from "vitest";
import { maxSimilarityToRecent, narrationSimilarity } from "./narrationSimilarity";

describe("narrationSimilarity", () => {
  it("deux textes identiques valent 1", () => {
    expect(narrationSimilarity("Bram sert une bière.", "Bram sert une bière.")).toBe(1);
  });

  it("deux textes sans un seul mot commun valent 0", () => {
    expect(narrationSimilarity("Bram sert une bière.", "Le vent souffle au loin.")).toBe(0);
  });

  it("ignore la casse et les accents — la même réplique doit se reconnaître", () => {
    expect(narrationSimilarity("Il repose sa pinte.", "IL REPOSE SA PINTE.")).toBe(1);
    expect(narrationSimilarity("Une odeur âcre monte.", "une odeur acre monte")).toBe(1);
  });

  it("une reformulation partielle donne un score intermédiaire, ni 0 ni 1", () => {
    const score = narrationSimilarity("Bram fronce les sourcils et repose sa pinte.", "Bram repose sa pinte sans un mot.");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("deux textes vides sont juges identiques, jamais une division par zero", () => {
    expect(narrationSimilarity("", "")).toBe(1);
    expect(() => narrationSimilarity("", "quelque chose")).not.toThrow();
  });
});

describe("maxSimilarityToRecent", () => {
  it("aucune narration recente : 0, rien a comparer", () => {
    expect(maxSimilarityToRecent("Bram sert une bière.", [])).toBe(0);
  });

  it("prend le maximum, pas la moyenne — une seule repetition suffit a alerter", () => {
    const score = maxSimilarityToRecent("Bram sert une bière.", ["Le vent souffle au loin.", "Bram sert une bière."]);
    expect(score).toBe(1);
  });
});
