import { describe, expect, it } from "vitest";
import { composeCharacterName } from "./characterName";

describe("composeCharacterName", () => {
  it("prenom et nom : « Prenom Nom »", () => {
    expect(composeCharacterName("Mira", "Vance")).toBe("Mira Vance");
  });
  it("espaces superflus retires", () => {
    expect(composeCharacterName("  Mira ", " Vance  ")).toBe("Mira Vance");
  });
  it("prenom seul ou nom seul", () => {
    expect(composeCharacterName("Mira", undefined)).toBe("Mira");
    expect(composeCharacterName("", "Vance")).toBe("Vance");
  });
  it("rien : chaine vide (l'appelant garde le nom existant)", () => {
    expect(composeCharacterName(undefined, undefined)).toBe("");
    expect(composeCharacterName("  ", "")).toBe("");
  });
});
