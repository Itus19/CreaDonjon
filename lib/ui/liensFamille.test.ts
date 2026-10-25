import { describe, expect, it } from "vitest";
import { LIENS_FAMILLE, lienFamille, relationPourLien, relationsPourEnfantDeCouple } from "./liensFamille";

describe("les neuf liens", () => {
  it("sont neuf, avec des clés distinctes", () => {
    expect(LIENS_FAMILLE).toHaveLength(9);
    expect(new Set(LIENS_FAMILLE.map((l) => l.cle)).size).toBe(9);
  });
});

describe("relationPourLien : la relation que la barre crée", () => {
  const lien = (cle: string) => {
    const l = lienFamille(cle);
    if (!l) throw new Error(cle);
    return l;
  };

  it("Enfant : la fiche touchée est le parent (source)", () => {
    expect(relationPourLien("fiche", "autre", lien("enfant"))).toEqual({
      sourceEntityId: "fiche",
      targetEntityId: "autre",
      relationType: "parent_of",
    });
  });
  it("Parent : l'autre fiche est le parent (source), la fiche touchée l'enfant", () => {
    expect(relationPourLien("fiche", "autre", lien("parent"))).toEqual({
      sourceEntityId: "autre",
      targetEntityId: "fiche",
      relationType: "parent_of",
    });
  });
  it("Beau-parent et Beau-enfant se répondent", () => {
    expect(relationPourLien("fiche", "autre", lien("beauParent"))).toEqual({ sourceEntityId: "autre", targetEntityId: "fiche", relationType: "step_parent_of" });
    expect(relationPourLien("fiche", "autre", lien("beauEnfant"))).toEqual({ sourceEntityId: "fiche", targetEntityId: "autre", relationType: "step_parent_of" });
  });
  it("Adopté(e) : la fiche touchée est l'adoptée (source de adopted_by)", () => {
    expect(relationPourLien("fiche", "autre", lien("adopte"))).toEqual({ sourceEntityId: "fiche", targetEntityId: "autre", relationType: "adopted_by" });
  });
  it("les liens symétriques gardent la fiche en source", () => {
    for (const [cle, type] of [
      ["partenaire", "partner_of"],
      ["exPartenaire", "ex_partner_of"],
      ["fratrie", "sibling_of"],
      ["demiFratrie", "half_sibling_of"],
    ] as const) {
      expect(relationPourLien("fiche", "autre", lien(cle))).toEqual({ sourceEntityId: "fiche", targetEntityId: "autre", relationType: type });
    }
  });
});

describe("relationsPourEnfantDeCouple", () => {
  it("crée un lien parent -> enfant pour chacun des deux parents", () => {
    expect(relationsPourEnfantDeCouple("a", "b", "e")).toEqual([
      { sourceEntityId: "a", targetEntityId: "e", relationType: "parent_of" },
      { sourceEntityId: "b", targetEntityId: "e", relationType: "parent_of" },
    ]);
  });
});
