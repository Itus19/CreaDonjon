import { describe, expect, it } from "vitest";
import { computeEncumbrance, encumbranceModifiers, totalCarriedWeight } from "./encumbrance";
import type { InventoryItem } from "../schemas/blocks/inventory";

// Seuils verifies dans le texte de regle du SRD 2014 (data/srd/srd-2014.json,
// Rule-Sections "using-each-ability", variante "Encumbrance") : capacite de
// charge = FOR x 15, encombre au-dela de FOR x 5, lourdement encombre
// au-dela de FOR x 10. Reutilise pour 2024 (meme mecanique, decision
// utilisateur — le SRD 2024 importe n'a pas de section de regle en texte
// libre equivalente a verifier).
describe("computeEncumbrance", () => {
  it("sous le seuil : aucun encombrement", () => {
    const result = computeEncumbrance(14, 50);
    expect(result).toEqual({ carried: 50, capacity: 210, tier: "none", speedPenalty: 0, disadvantageAbilities: [] });
  });

  it("exactement au seuil encombre (FOR x 5) : pas encore encombre (« en exces de »)", () => {
    const result = computeEncumbrance(10, 50);
    expect(result.tier).toBe("none");
  });

  it("juste au-dessus du seuil encombre : vitesse -10, aucun desavantage", () => {
    const result = computeEncumbrance(10, 51);
    expect(result).toMatchObject({ tier: "encumbered", speedPenalty: 10, disadvantageAbilities: [] });
  });

  it("exactement au seuil lourdement encombre (FOR x 10) : encore seulement encombre", () => {
    const result = computeEncumbrance(10, 100);
    expect(result.tier).toBe("encumbered");
  });

  it("juste au-dessus du seuil lourdement encombre : vitesse -20, desavantage FOR/DEX/CON", () => {
    const result = computeEncumbrance(10, 101);
    expect(result).toMatchObject({ tier: "heavily_encumbered", speedPenalty: 20, disadvantageAbilities: ["str", "dex", "con"] });
  });
});

describe("encumbranceModifiers", () => {
  it("aucun modificateur si pas encombre", () => {
    const result = computeEncumbrance(14, 50);
    expect(encumbranceModifiers(result, "encumbrance", "Encombrement")).toEqual([]);
  });

  it("penalite de vitesse seule si simplement encombre", () => {
    const result = computeEncumbrance(10, 51);
    expect(encumbranceModifiers(result, "encumbrance", "Encombrement")).toEqual([
      { target: "speed", op: "add", value: -10, layer: 6, source: "encumbrance", label: "Encombrement" },
    ]);
  });

  it("vitesse -20 + desavantage sur les jets FOR/DEX/CON (sauvegardes et competences gouvernees) si lourdement encombre", () => {
    const result = computeEncumbrance(10, 101);
    const modifiers = encumbranceModifiers(result, "encumbrance", "Encombrement");
    expect(modifiers).toContainEqual({ target: "speed", op: "add", value: -20, layer: 6, source: "encumbrance", label: "Encombrement" });
    expect(modifiers).toContainEqual({ target: "save.str", op: "disadvantage", layer: 6, source: "encumbrance", label: "Encombrement" });
    expect(modifiers).toContainEqual({ target: "save.dex", op: "disadvantage", layer: 6, source: "encumbrance", label: "Encombrement" });
    expect(modifiers).toContainEqual({ target: "save.con", op: "disadvantage", layer: 6, source: "encumbrance", label: "Encombrement" });
    expect(modifiers).toContainEqual({ target: "skill.athletics", op: "disadvantage", layer: 6, source: "encumbrance", label: "Encombrement" });
    expect(modifiers).toContainEqual({ target: "skill.stealth", op: "disadvantage", layer: 6, source: "encumbrance", label: "Encombrement" });
    // Aucune competence n'est gouvernee par CON (§SKILL_ABILITIES) : pas de cible skill.* attendue au-dela de FOR/DEX.
    expect(modifiers.filter((m) => m.target.startsWith("skill."))).toHaveLength(4);
  });
});

function refItem(id: string, key: string, qty: number): InventoryItem {
  return { id, qty, ref: { kind: "rule", key } };
}
function inlineItem(id: string, qty: number, weight?: number): InventoryItem {
  return weight === undefined ? { id, qty, label: "Objet" } : { id, qty, label: "Objet", weight: { value: weight, unit: "lb" } };
}

describe("totalCarriedWeight", () => {
  it("somme le poids des objets de reference (resolu par cle) multiplie par la quantite", () => {
    const items = [refItem("i1", "chain-mail", 1), refItem("i2", "dagger", 3)];
    const weightByKey = { "chain-mail": 55, dagger: 1 };
    expect(totalCarriedWeight(items, weightByKey)).toBe(55 + 3 * 1);
  });

  it("utilise le poids en ligne d'un objet sans reference", () => {
    const items = [inlineItem("i1", 2, 5)];
    expect(totalCarriedWeight(items, {})).toBe(10);
  });

  it("compte 0 pour un objet de reference dont le poids n'est pas resolu, ou un objet en ligne sans poids renseigne", () => {
    const items = [refItem("i1", "objet-maison", 1), inlineItem("i2", 4)];
    expect(totalCarriedWeight(items, { "objet-maison": null })).toBe(0);
  });
});
