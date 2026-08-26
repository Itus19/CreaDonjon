import { describe, expect, it } from "vitest";
import { hasReachedNextLevel, nextLevelThreshold, XP_LEVEL_THRESHOLDS } from "./experience";

describe("nextLevelThreshold", () => {
  it("renvoie le seuil du niveau suivant", () => {
    expect(nextLevelThreshold(1)).toBe(300);
    expect(nextLevelThreshold(19)).toBe(355000);
  });

  it("renvoie null au niveau maximum, aucun seuil suivant", () => {
    expect(nextLevelThreshold(20)).toBeNull();
  });
});

describe("hasReachedNextLevel", () => {
  it("faux juste en dessous du seuil, vrai a partir du seuil", () => {
    expect(hasReachedNextLevel(1, 299)).toBe(false);
    expect(hasReachedNextLevel(1, 300)).toBe(true);
    expect(hasReachedNextLevel(1, 301)).toBe(true);
  });

  it("toujours faux au niveau maximum, quel que soit le PX", () => {
    expect(hasReachedNextLevel(20, XP_LEVEL_THRESHOLDS[19] + 1_000_000)).toBe(false);
  });
});
