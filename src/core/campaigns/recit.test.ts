import { describe, expect, it } from "vitest";
import { DEFAULT_RECIT, REGISTRE_MAX, mergeRecit, parseRecit, zRecitPatch } from "./recit";

describe("réglage « Récit » (V3.2-5)", () => {
  it("une colonne vide donne le défaut : « tu », registre de l'auteur, scènes intimes coupées", () => {
    expect(parseRecit(undefined)).toEqual(DEFAULT_RECIT);
    expect(DEFAULT_RECIT.scenes_intimes).toBe(false);
  });

  it("une valeur illisible retombe sur le défaut, jamais sur « scènes intimes permises »", () => {
    expect(parseRecit({ personne: "elle", scenes_intimes: "oui" })).toEqual(DEFAULT_RECIT);
  });

  it("un registre volontairement vide est gardé tel quel", () => {
    expect(parseRecit({ registre: "" }).registre).toBe("");
  });

  it("le schéma d'écriture refuse une clé inconnue et un texte trop long", () => {
    expect(zRecitPatch.safeParse({ ton: "léger" }).success).toBe(false);
    expect(zRecitPatch.safeParse({ registre: "x".repeat(REGISTRE_MAX + 1) }).success).toBe(false);
    expect(zRecitPatch.safeParse({ personne: "vous" }).success).toBe(true);
  });

  it("fusionne champ par champ", () => {
    expect(mergeRecit(DEFAULT_RECIT, { scenes_intimes: true })).toEqual({ ...DEFAULT_RECIT, scenes_intimes: true });
    expect(mergeRecit(DEFAULT_RECIT, undefined)).toBe(DEFAULT_RECIT);
  });
});
