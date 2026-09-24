import { describe, expect, it } from "vitest";
import { createHomebrewSpellSchema, createHomebrewSubclassSchema } from "./schemas";

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

describe("createHomebrewSpellSchema (V2-N2)", () => {
  const valid = {
    rulesetId: "00000000-0000-4000-8000-000000000000",
    name: "Piqûre mentale",
    level: 0,
    school: "Enchantment",
    castingTime: "1 action",
    range: "18 mètres",
    components: ["V"],
    duration: "Instantanée",
    concentration: false,
    ritual: false,
    effect: null,
    classKeys: ["wizard"],
  };

  it("accepte un sort sans effet chiffre ni montee en puissance", () => {
    const parsed = createHomebrewSpellSchema.parse(valid);
    expect(parsed.scaling).toEqual([]);
    expect(parsed.material).toBe("");
  });

  it("exige au moins une classe", () => {
    const result = createHomebrewSpellSchema.safeParse({ ...valid, classKeys: [] });
    expect(result.error?.issues[0]?.message).toBe("Coche au moins une classe.");
  });

  it("borne le niveau entre 0 et 9", () => {
    expect(createHomebrewSpellSchema.safeParse({ ...valid, level: 10 }).success).toBe(false);
    expect(createHomebrewSpellSchema.safeParse({ ...valid, level: -1 }).success).toBe(false);
  });

  it("refuse une ecole, une caracteristique ou un type de degats hors liste", () => {
    expect(createHomebrewSpellSchema.safeParse({ ...valid, school: "Chronomancy" }).success).toBe(false);
    const effect = { kind: "save", ability: "dex", attackRange: "ranged", formula: "1d6", damageType: "fire", onSuccess: "half" };
    expect(createHomebrewSpellSchema.safeParse({ ...valid, effect }).success).toBe(true);
    expect(createHomebrewSpellSchema.safeParse({ ...valid, effect: { ...effect, ability: "luck" } }).success).toBe(false);
    expect(createHomebrewSpellSchema.safeParse({ ...valid, effect: { ...effect, damageType: "sonic" } }).success).toBe(false);
  });

  it("exige une formule quand un effet chiffre est ouvert", () => {
    const effect = { kind: "none", ability: "dex", attackRange: "ranged", formula: " ", damageType: "force", onSuccess: "half" };
    expect(createHomebrewSpellSchema.safeParse({ ...valid, effect }).success).toBe(false);
  });
});
