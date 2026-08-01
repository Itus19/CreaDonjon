import { describe, expect, it } from "vitest";
import { nextNumericSlug, nextSlugCandidate, slugify } from "./slug";

describe("slugify", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(slugify("Valdoria")).toBe("valdoria");
    expect(slugify("Mon Super Monde")).toBe("mon-super-monde");
  });

  it("retire les accents", () => {
    expect(slugify("Forêt Enchantée")).toBe("foret-enchantee");
  });

  it("retire la ponctuation et les caracteres non alphanumeriques", () => {
    expect(slugify("L'Ancre Rouillée !!!")).toBe("l-ancre-rouillee");
  });

  it("compresse les tirets multiples et coupe ceux en bordure", () => {
    expect(slugify("  --Test--  ")).toBe("test");
    expect(slugify("a   b")).toBe("a-b");
  });

  it("produit une chaine vide pour une entree sans caractere alphanumerique", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("nextSlugCandidate", () => {
  it("ajoute -2 au premier essai suivant le slug de base", () => {
    expect(nextSlugCandidate("valdoria", 1)).toBe("valdoria-2");
  });

  it("incremente ensuite normalement", () => {
    expect(nextSlugCandidate("valdoria", 4)).toBe("valdoria-5");
  });
});

describe("nextNumericSlug", () => {
  it("commence a 1 quand il n'y a aucun slug existant", () => {
    expect(nextNumericSlug([])).toBe("1");
  });

  it("prend le plus grand numero existant et l'incremente", () => {
    expect(nextNumericSlug(["1", "2", "3"])).toBe("4");
    expect(nextNumericSlug(["1", "5", "3"])).toBe("6");
  });

  it("ignore les anciens slugs derives d'un nom (entites creees avant ce changement)", () => {
    expect(nextNumericSlug(["bram", "l-ancre-rouillee", "7"])).toBe("8");
  });

  it("recommence a 1 si aucun slug existant n'est numerique", () => {
    expect(nextNumericSlug(["bram", "l-ancre-rouillee"])).toBe("1");
  });
});
