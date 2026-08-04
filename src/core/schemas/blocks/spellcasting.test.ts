import { describe, expect, it } from "vitest";
import { zSpellcastingBlockData } from "./spellcasting";

describe("zSpellcastingBlockData", () => {
  it("valide une incantation complete", () => {
    const data = {
      __v: 1 as const,
      sources: [{ class: "wizard", ability: "int" as const }],
      known: [{ ref: { kind: "rule" as const, key: "fireball" }, origin: "spellbook" }],
      prepared: ["fireball", "shield"],
      slot_override: null,
    };
    expect(zSpellcastingBlockData.parse(data)).toEqual(data);
  });

  it("accepte une surcharge d'emplacements", () => {
    const data = {
      __v: 1,
      sources: [{ class: "wizard", ability: "int" }],
      known: [],
      prepared: [],
      slot_override: { "1": 4, "2": 2 },
    };
    expect(zSpellcastingBlockData.parse(data)).toEqual(data);
  });

  it("rejette une caracteristique d'incantation inconnue", () => {
    const data = {
      __v: 1,
      sources: [{ class: "wizard", ability: "luck" }],
      known: [],
      prepared: [],
      slot_override: null,
    };
    expect(() => zSpellcastingBlockData.parse(data)).toThrow();
  });
});
