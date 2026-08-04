import { describe, expect, it } from "vitest";
import { zCharacterBlockData } from "./character";

describe("zCharacterBlockData", () => {
  const valid = {
    __v: 1 as const,
    species: { kind: "rule" as const, key: "orc" },
    background: { kind: "rule" as const, key: "soldier" },
    classes: [{ class: { kind: "rule" as const, key: "fighter" }, level: 1, subclass: null }],
    abilities: {
      method: "standard_array" as const,
      base: { str: 15, dex: 14, con: 15, int: 12, wis: 10, cha: 8 },
    },
    choices: { "fighter.l1.skills": ["athletics", "intimidation"] },
    hp_method: "fixed" as const,
    portrait_asset_id: null,
  };

  it("valide un build complet", () => {
    expect(zCharacterBlockData.parse(valid)).toEqual(valid);
  });

  it("accepte espece/historique absents (creation en cours)", () => {
    expect(() => zCharacterBlockData.parse({ ...valid, species: null, background: null })).not.toThrow();
  });

  it("rejette une valeur derivee glissee par erreur (.strict())", () => {
    expect(() => zCharacterBlockData.parse({ ...valid, ac: 18 })).toThrow();
  });

  it("rejette un niveau de classe invalide (>= 1 requis)", () => {
    expect(() => zCharacterBlockData.parse({ ...valid, classes: [{ class: { kind: "rule", key: "fighter" }, level: 0, subclass: null }] })).toThrow();
  });
});
