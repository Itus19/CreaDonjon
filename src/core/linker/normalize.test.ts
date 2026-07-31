import { describe, expect, it } from "vitest";
import { normalizeForMatching } from "./normalize";

describe("normalizeForMatching", () => {
  it("met en minuscule", () => {
    expect(normalizeForMatching("Baldur")).toBe("baldur");
  });

  it("retire les accents", () => {
    expect(normalizeForMatching("L'Ancre Rouillée")).toBe("l'ancre rouillee");
  });

  it("gere plusieurs accents et la cedille", () => {
    expect(normalizeForMatching("Épée Légère à Façade")).toBe("epee legere a facade");
  });

  it("garde la meme longueur que le texte original (alignement des index)", () => {
    const original = "Épée Légère à Façade, château démesuré";
    expect(normalizeForMatching(original)).toHaveLength(original.length);
  });

  it("ne modifie pas les caracteres deja normalises", () => {
    expect(normalizeForMatching("baldur")).toBe("baldur");
  });

  it("est stable pour une chaine vide", () => {
    expect(normalizeForMatching("")).toBe("");
  });
});
