import { describe, expect, it } from "vitest";
import { missingRequiredBlocks } from "./requiredBlocks";

describe("missingRequiredBlocks", () => {
  it("ne signale rien quand tous les blocs requis sont presents", () => {
    expect(missingRequiredBlocks("spell", ["spell_casting", "effects", "description"])).toEqual([]);
  });

  it("signale les blocs requis absents, sans rejeter l'entree", () => {
    expect(missingRequiredBlocks("spell", ["description"])).toEqual(["spell_casting", "effects"]);
  });

  it("signale les trois blocs requis manquants pour une classe (V1-D1)", () => {
    expect(missingRequiredBlocks("class", ["description"])).toEqual(["class_progression", "class_basics", "subclass_slot"]);
  });

  it("signale un seul bloc manquant pour une classe qui a deja sa progression et sa base", () => {
    expect(missingRequiredBlocks("class", ["description", "class_progression", "class_basics"])).toEqual(["subclass_slot"]);
  });

  it("ne signale rien pour un entry_type sans bloc requis declare", () => {
    expect(missingRequiredBlocks("condition", [])).toEqual([]);
  });
});
