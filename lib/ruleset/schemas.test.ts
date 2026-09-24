import { describe, expect, it } from "vitest";
import { createHomebrewSubclassSchema } from "./schemas";

describe("createHomebrewSubclassSchema (V2-N1)", () => {
  const valid = {
    rulesetId: "00000000-0000-4000-8000-000000000000",
    name: "Arnaqueur arcanique",
    parentClassKey: "rogue",
    features: [{ name: "Incantation", level: 3, description: "" }],
  };

  it("accepte une sous-classe minimale, description et page absentes", () => {
    const parsed = createHomebrewSubclassSchema.parse(valid);
    expect(parsed.description).toBe("");
    expect(parsed.pageRef).toBe("");
  });

  it("refuse une sous-classe sans aptitude nommee", () => {
    const result = createHomebrewSubclassSchema.safeParse({ ...valid, features: [{ name: "  ", level: 3, description: "" }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Ajoute au moins une aptitude nommée.");
  });

  it("refuse une classe parente absente", () => {
    expect(createHomebrewSubclassSchema.safeParse({ ...valid, parentClassKey: " " }).success).toBe(false);
  });

  it("borne le niveau d'une aptitude entre 1 et 20", () => {
    expect(createHomebrewSubclassSchema.safeParse({ ...valid, features: [{ name: "X", level: 21, description: "" }] }).success).toBe(false);
    expect(createHomebrewSubclassSchema.safeParse({ ...valid, features: [{ name: "X", level: 0, description: "" }] }).success).toBe(false);
  });

  it("refuse une description longue : la prose d'un livre se reference", () => {
    expect(createHomebrewSubclassSchema.safeParse({ ...valid, description: "a".repeat(2001) }).success).toBe(false);
  });
});
