import { describe, expect, it } from "vitest";
import { ecrireRailReplie, lireRailReplie } from "./rail";

describe("lireRailReplie", () => {
  it('lit "1" comme replié', () => {
    expect(lireRailReplie("1")).toBe(true);
  });

  it("lit l'absence de valeur comme déplié", () => {
    expect(lireRailReplie(null)).toBe(false);
  });

  it('lit "0", la chaîne vide et toute autre valeur comme déplié', () => {
    expect(lireRailReplie("0")).toBe(false);
    expect(lireRailReplie("")).toBe(false);
    expect(lireRailReplie("true")).toBe(false);
    expect(lireRailReplie("2")).toBe(false);
  });

  it("relit ce qu'elle a écrit", () => {
    expect(lireRailReplie(ecrireRailReplie(true))).toBe(true);
    expect(lireRailReplie(ecrireRailReplie(false))).toBe(false);
  });
});
