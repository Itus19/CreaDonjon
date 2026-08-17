import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, defaultBlockData, validateBlockData } from "./registry";

describe("registry des blocs de wiki", () => {
  it("valide les donnees par defaut de chaque type", () => {
    for (const blockType of BLOCK_TYPES) {
      expect(() => validateBlockData(blockType, defaultBlockData(blockType))).not.toThrow();
    }
  });

  it("rejette un __v manquant", () => {
    expect(() => validateBlockData("infobox", { entries: [] })).toThrow();
  });

  it("rejette une donnee qui ne correspond pas au type", () => {
    expect(() => validateBlockData("infobox", { __v: 1, images: [] })).toThrow();
  });

  it("valide un infobox avec des entrees", () => {
    const data = { __v: 1, entries: [{ label: "Population", value: "12 000" }] };
    expect(validateBlockData("infobox", data)).toEqual(data);
  });

  it("valide une image avec une legende", () => {
    const data = { __v: 1, url: "https://example.com/bram.png", caption: "Bram" };
    expect(validateBlockData("image", data)).toEqual(data);
  });

  it("valide un custom_table", () => {
    const data = { __v: 1, columns: ["Nom", "Role"], rows: [{ Nom: "Bram", Role: "Forgeron" }] };
    expect(validateBlockData("custom_table", data)).toEqual(data);
  });

  it("valide un random_table avec une reference d'entite", () => {
    const data = {
      __v: 1,
      key: "rumeurs",
      die: "d20",
      entries: [
        {
          range: { min: 1, max: 3 },
          weight: 3,
          text: "Un enfant a disparu près du vieux moulin.",
          refs: [{ kind: "entity" as const, id: "ent_moulin" }],
        },
      ],
      unique_draws: false,
    };
    expect(validateBlockData("random_table", data)).toEqual(data);
  });

  it("rejette une notation de dé invalide sur random_table", () => {
    const data = {
      __v: 1,
      key: "rumeurs",
      die: "20",
      entries: [{ range: { min: 1, max: 20 }, weight: 20, text: "x" }],
      unique_draws: false,
    };
    expect(() => validateBlockData("random_table", data)).toThrow();
  });

  it("valide un texte avec des segments", () => {
    const data = {
      __v: 1,
      segments: [
        {
          id: "s1",
          blockType: "paragraph" as const,
          visibility: { level: "public" as const, scopeId: null },
          content: [{ t: "text" as const, v: "Un texte." }],
        },
      ],
    };
    expect(validateBlockData("text", data)).toEqual(data);
  });
});
