import { describe, expect, it } from "vitest";
import { missingRequiredBlocks } from "./requiredBlocks";

describe("missingRequiredBlocks", () => {
  it("ne signale rien quand tous les blocs requis sont presents", () => {
    expect(missingRequiredBlocks("spell", ["spell_casting", "effects", "description"])).toEqual([]);
  });

  it("signale les blocs requis absents, sans rejeter l'entree", () => {
    expect(missingRequiredBlocks("spell", ["description"])).toEqual(["spell_casting", "effects"]);
  });

  it("signale un seul bloc manquant pour une classe", () => {
    expect(missingRequiredBlocks("class", ["description"])).toEqual(["class_progression"]);
  });

  it("ne signale rien pour un entry_type sans bloc requis declare", () => {
    expect(missingRequiredBlocks("condition", [])).toEqual([]);
  });
});
