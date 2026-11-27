import { describe, expect, it } from "vitest";
import { interpretIntent, type IntentCatalog } from "@/src/core/rules/intent";
import { INTENT_HYPOTHETICAL_MARKERS_FR, INTENT_VERBS_FR } from "./fr";

/**
 * V3.2-46 — les phrases réellement jouées, lues par le VRAI lexique français
 * (le test du noyau, lui, utilise un lexique de démonstration).
 */
const CATALOG: IntentCatalog = {
  actions: [
    { id: "item-epee", kind: "weapon_attack", label: "Épée longue", terms: ["épée longue"] },
    { id: "perception", kind: "skill_check", label: "Perception", terms: ["Perception"] },
    { id: "insight", kind: "skill_check", label: "Perspicacité", terms: ["Perspicacité"] },
  ],
  targets: [{ id: "mabelle", label: "Mabelle", terms: ["Mabelle"] }],
  verbs: INTENT_VERBS_FR,
  hypotheticalMarkers: INTENT_HYPOTHETICAL_MARKERS_FR,
};

describe("le lexique français sur des phrases jouées", () => {
  it("jauger quelqu'un avant une attaque hypothétique demande de la Perception, pas une attaque", () => {
    const proposal = interpretIntent("j'essaie de déterminer si Mabelle semble apte à se défendre si je viendrais à l'attaquer", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.action.id).toBe("perception");
    expect(proposal.kind === "mechanical" && proposal.target?.id).toBe("mabelle");
  });

  it("une attaque sous hypothèse seule ne lance rien", () => {
    expect(interpretIntent("et si j'attaque Mabelle ?", CATALOG).kind).toBe("free");
  });

  it("une attaque franche reste une attaque", () => {
    const proposal = interpretIntent("j'attaque Mabelle", CATALOG);
    expect(proposal.kind === "mechanical" && proposal.actionKind).toBe("weapon_attack");
  });
});
