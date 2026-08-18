import { describe, expect, it } from "vitest";
import { zTextProposal, textProposalToolSchema } from "./writingProposal";

describe("zTextProposal", () => {
  it("accepte un texte simple", () => {
    const result = zTextProposal.safeParse({ text: "Le donjon est gardé par un dragon endormi." });
    expect(result.success).toBe(true);
  });

  it("rejette un texte vide", () => {
    const result = zTextProposal.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejette un texte demesure (garde-fou de longueur)", () => {
    const result = zTextProposal.safeParse({ text: "a".repeat(3000) });
    expect(result.success).toBe(false);
  });

  it("n'accepte aucun champ d'identifiant — la forme ne permet structurellement pas au modele de cibler quoi que ce soit", () => {
    const result = zTextProposal.safeParse({ text: "Texte valide.", entityId: "invente", blockId: "invente" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["text"]);
    }
  });
});

describe("textProposalToolSchema", () => {
  it("expose uniquement le champ text, jamais d'identifiant", () => {
    expect(Object.keys(textProposalToolSchema.properties)).toEqual(["text"]);
    expect(textProposalToolSchema.required).toEqual(["text"]);
  });
});
