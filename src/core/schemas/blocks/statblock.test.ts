import { describe, expect, it } from "vitest";
import { zStatblockBlockData } from "./statblock";

describe("zStatblockBlockData", () => {
  it("valide un gobelin, sans build", () => {
    const data = {
      __v: 1 as const,
      size: "Petite",
      creature_type: "humanoïde (gobelinoïde)",
      alignment: "Neutre mauvais",
      ac: { value: 15, source: "armure de cuir clouté, bouclier" },
      hp: { value: 7, hit_dice: "2d6" },
      speed: "9 m",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      saving_throws: { dex: 4 },
      skills: { stealth: 6 },
      senses: "vision dans le noir 18 m",
      languages: "commun, gobelin",
      challenge_rating: "1/4",
      traits: [{ name: "Tactique de groupe", text: "..." }],
      actions: [{ name: "Cimeterre", text: "..." }],
      reactions: [],
      legendary_actions: [],
    };
    expect(zStatblockBlockData.parse(data)).toEqual(data);
  });

  it("accepte les champs optionnels absents", () => {
    const data = {
      __v: 1,
      size: "Moyenne",
      creature_type: "humanoïde",
      ac: { value: 10 },
      hp: { value: 4 },
      speed: "9 m",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      traits: [],
      actions: [],
      reactions: [],
      legendary_actions: [],
    };
    expect(() => zStatblockBlockData.parse(data)).not.toThrow();
  });

  // V3.1-147 : repaire et défenses, optionnels — un bloc écrit avant reste valide.
  const base = {
    __v: 1 as const,
    size: "Grande",
    creature_type: "dragon",
    ac: { value: 18 },
    hp: { value: 178 },
    speed: "12 m, vol 24 m",
    abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    traits: [],
    actions: [],
    reactions: [],
    legendary_actions: [],
  };

  it("accepte un repaire qui vise une fiche et des défenses", () => {
    const data = {
      ...base,
      lair: { kind: "entity" as const, id: "11111111-1111-1111-1111-111111111111" },
      defenses: {
        damage_immunities: ["feu"],
        damage_resistances: ["froid", "contondant non magique"],
        condition_immunities: ["charmé", "effrayé"],
      },
    };
    expect(zStatblockBlockData.parse(data)).toEqual(data);
  });

  it("refuse un repaire qui vise une règle", () => {
    expect(() => zStatblockBlockData.parse({ ...base, lair: { kind: "rule", key: "lair" } })).toThrow();
  });

  it("refuse une défense vide", () => {
    expect(() => zStatblockBlockData.parse({ ...base, defenses: { damage_immunities: [""] } })).toThrow();
  });

  it("un ancien bloc, sans repaire ni défenses, reste valide et inchangé", () => {
    const parsed = zStatblockBlockData.parse(base);
    expect(parsed.lair).toBeUndefined();
    expect(parsed.defenses).toBeUndefined();
  });
});
