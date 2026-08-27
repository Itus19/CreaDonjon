import { describe, expect, it } from "vitest";
import { RELATION_TYPES, relationLabel } from "./inverses";

describe("relationLabel", () => {
  it("retourne le type tel quel pour le sens sortant", () => {
    expect(relationLabel("parent_of", "out")).toBe("parent_of");
  });

  it("retourne l'inverse pour le sens entrant", () => {
    expect(relationLabel("parent_of", "in")).toBe("child_of");
    expect(relationLabel("owns", "in")).toBe("owned_by");
  });

  it("est symetrique pour les relations reciproques", () => {
    expect(relationLabel("married_to", "in")).toBe("married_to");
    expect(relationLabel("sibling_of", "in")).toBe("sibling_of");
  });

  it("connait les quatre types ajoutes pour le bloc genealogie (V2-H3)", () => {
    expect(relationLabel("partner_of", "in")).toBe("partner_of");
    expect(relationLabel("ex_partner_of", "in")).toBe("ex_partner_of");
    expect(relationLabel("half_sibling_of", "in")).toBe("half_sibling_of");
    expect(relationLabel("step_parent_of", "in")).toBe("step_child_of");
  });

  it("definit un inverse pour chaque type du vocabulaire ferme", () => {
    for (const type of RELATION_TYPES) {
      expect(relationLabel(type, "in")).toBeTruthy();
    }
  });
});
