import { describe, it, expect } from "vitest";
import { dieSidesFromFormula, DIE_SHAPES } from "./dieSides";

describe("dieSidesFromFormula", () => {
  it("lit le de d'une formule resolue", () => {
    expect(dieSidesFromFormula("1d20+7")).toBe(20);
    expect(dieSidesFromFormula("1d4+4")).toBe(4);
    expect(dieSidesFromFormula("2d6")).toBe(6);
    expect(dieSidesFromFormula("1d8")).toBe(8);
  });

  it("lit le PREMIER de quand la formule en melange plusieurs", () => {
    // Degats d'une arme magique ("1d8+1d6 feu") : le de de base commande le
    // dessin, pas le de additionnel.
    expect(dieSidesFromFormula("1d8+1d6")).toBe(8);
  });

  it("tolere les majuscules et les espaces", () => {
    expect(dieSidesFromFormula("1D12 + 3")).toBe(12);
    expect(dieSidesFromFormula("  1d10  ")).toBe(10);
  });

  it("lit un de sans quantite explicite", () => {
    expect(dieSidesFromFormula("d20+5")).toBe(20);
  });

  // Le libelle d'un bouton n'est pas toujours une formule : un sort sans
  // degats affiche "Sort mineur", un emplacement affiche "2/3".
  it("rend null quand il n'y a aucun de", () => {
    expect(dieSidesFromFormula("Sort mineur")).toBeNull();
    expect(dieSidesFromFormula("2/3")).toBeNull();
    expect(dieSidesFromFormula("")).toBeNull();
    expect(dieSidesFromFormula("emplacements")).toBeNull();
  });

  it("ne confond pas un de avec un mot contenant un d suivi de chiffres", () => {
    expect(dieSidesFromFormula("niveau 3")).toBeNull();
    expect(dieSidesFromFormula("DD 15")).toBeNull();
  });

  it("rend null pour un de dont aucune forme n'existe", () => {
    expect(dieSidesFromFormula("1d7")).toBeNull();
    expect(dieSidesFromFormula("1d100")).toBeNull();
  });

  it("n'expose que des formes reellement dessinees", () => {
    for (const sides of DIE_SHAPES) expect([4, 6, 8, 10, 12, 20]).toContain(sides);
  });
});
