import { describe, expect, it } from "vitest";
import { archetypeFor } from "./archetype";

describe("archetypeFor", () => {
  it("retourne Equilibre quand tous les poles sont dans la bande neutre", () => {
    expect(archetypeFor({})).toEqual({ name: "Équilibré", colorVar: "--pole-neutral" });
    expect(archetypeFor({ curiosity_caution: 5, altruism_selfishness: -11 })).toEqual({
      name: "Équilibré",
      colorVar: "--pole-neutral",
    });
  });

  it("nomme le seul pole marque quand un seul depasse la bande neutre", () => {
    expect(archetypeFor({ empathy_hardness: 40 })).toEqual({ name: "Empathique", colorVar: "--pole-empathy" });
    expect(archetypeFor({ empathy_hardness: -40 })).toEqual({ name: "Impitoyable", colorVar: "--pole-hardness" });
  });

  it("combine les deux poles les plus marques, couleur du plus fort", () => {
    const result = archetypeFor({ empathy_hardness: -60, impulse_prudence: 30 });
    expect(result).toEqual({ name: "Impitoyable et impulsif", colorVar: "--pole-hardness" });
  });

  it("ignore un troisieme pole meme marque, ne garde que les deux plus forts", () => {
    const result = archetypeFor({
      empathy_hardness: 90,
      impulse_prudence: 50,
      authority_independence: 15,
    });
    expect(result.name).toBe("Empathique et impulsif");
  });

  it("depart deterministe entre deux poles de meme intensite absolue (ordre de PERSONALITY_POLE_KEYS)", () => {
    const result = archetypeFor({ authority_independence: 50, curiosity_caution: 50 });
    // curiosity_caution vient avant authority_independence dans PERSONALITY_POLE_KEYS
    expect(result.name).toBe("Curieux et autoritaire");
  });
});
