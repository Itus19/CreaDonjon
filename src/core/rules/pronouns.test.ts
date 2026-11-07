import { describe, expect, it } from "vitest";
import { PRONOUN_SETS, pronounGuidance, zPronouns } from "./pronouns";

/**
 * V3.1-170 — Les pronoms d'une entité : des jeux connus (plusieurs
 * possibles) plus une saisie libre. Une ancienne valeur texte se relit comme
 * saisie libre, sans migration. Une fonction pure dit comment accorder.
 */

describe("les jeux de pronoms connus", () => {
  it("une seule liste : il, elle, iel, ils, elles, chacun avec ses formes", () => {
    expect(PRONOUN_SETS.map((p) => p.label)).toEqual(["il", "elle", "iel", "ils", "elles"]);
    expect(PRONOUN_SETS.find((p) => p.key === "neutral")?.forms).toBe("iel/lae/ellui");
    expect(new Set(PRONOUN_SETS.map((p) => p.key)).size).toBe(PRONOUN_SETS.length);
  });
});

describe("zPronouns — la forme stockée, et la reprise de l'ancien texte", () => {
  it("une liste de jeux et une saisie libre", () => {
    expect(zPronouns.parse({ sets: ["he", "she"], custom: "" })).toEqual({ sets: ["he", "she"] });
    expect(zPronouns.parse({ sets: [], custom: "ael" })).toEqual({ sets: [], custom: "ael" });
  });

  it("un ancien texte devient une saisie libre ; un texte vide, rien", () => {
    expect(zPronouns.parse("elle, il")).toEqual({ sets: [], custom: "elle, il" });
    expect(zPronouns.parse("   ")).toEqual({ sets: [] });
  });

  it("un jeu inconnu est refusé, un jeu en double compté une fois", () => {
    expect(zPronouns.safeParse({ sets: ["xe"] }).success).toBe(false);
    expect(zPronouns.parse({ sets: ["he", "he"] })).toEqual({ sets: ["he"] });
  });
});

describe("pronounGuidance — comment accorder l'entité", () => {
  it("rien de choisi : rien à dire (le modèle ne devine pas)", () => {
    expect(pronounGuidance(undefined)).toBeNull();
    expect(pronounGuidance({ sets: [] })).toBeNull();
  });

  it("un jeu : ses formes", () => {
    expect(pronounGuidance({ sets: ["she"] })).toBe("elle (elle/la/elle)");
  });

  it("plusieurs jeux : en alternance, dans l'ordre choisi", () => {
    expect(pronounGuidance({ sets: ["he", "she"] })).toBe("il et elle, en alternance (il/le/lui ; elle/la/elle)");
  });

  it("une saisie libre s'ajoute telle quelle, seule ou après les jeux", () => {
    expect(pronounGuidance({ sets: [], custom: "ael" })).toBe("« ael »");
    expect(pronounGuidance({ sets: ["neutral"], custom: "ael" })).toBe("iel (iel/lae/ellui) ; aussi « ael »");
  });
});
