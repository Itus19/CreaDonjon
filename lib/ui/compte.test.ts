import { describe, expect, it } from "vitest";
import { compteDuContexte, sectionsCompte } from "./compte";

const monde = (mode: "campaign" | "solo" | null, myRole: "gm" | "player" | null) => ({
  id: Math.random().toString(),
  mode,
  myRole,
  nextSession: null,
  myCharacter: null,
  players: [],
});

describe("ligne de contexte du Compte (V3.1-80)", () => {
  it("compte les mondes menés, joués et en solo, sans recouvrement", () => {
    expect(compteDuContexte([monde("campaign", "gm"), monde("campaign", "player"), monde("campaign", "player"), monde("campaign", "player"), monde("solo", "gm")])).toEqual({
      mene: 1,
      joue: 3,
      solo: 1,
    });
  });
  it("aucun monde : tout à zéro", () => {
    expect(compteDuContexte([])).toEqual({ mene: 0, joue: 0, solo: 0 });
  });
});

describe("sections du Compte (V3.1-80)", () => {
  it("six sections dans l'ordre décidé quand on a rejoint par un lien", () => {
    expect(sectionsCompte({ aRejointParUnLien: true })).toEqual(["identite", "connexion", "invitation", "apparence", "langue", "suppression"]);
  });
  it("sans lien d'invitation, la section et son entrée de sommaire disparaissent", () => {
    expect(sectionsCompte({ aRejointParUnLien: false })).toEqual(["identite", "connexion", "apparence", "langue", "suppression"]);
  });
});
