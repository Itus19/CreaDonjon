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

  it("valide une gallery avec une image portrait", () => {
    const data = {
      __v: 1,
      images: [{ url: "https://example.com/bram.png", caption: "Bram", isPortrait: true }],
    };
    expect(validateBlockData("gallery", data)).toEqual(data);
  });

  it("rejette une gallery avec une url invalide", () => {
    expect(() =>
      validateBlockData("gallery", { __v: 1, images: [{ url: "pas-une-url", caption: "" }] })
    ).toThrow();
  });

  it("valide un custom_table", () => {
    const data = { __v: 1, columns: ["Nom", "Role"], rows: [{ Nom: "Bram", Role: "Forgeron" }] };
    expect(validateBlockData("custom_table", data)).toEqual(data);
  });

  it("valide une description avec des segments", () => {
    const data = {
      __v: 1,
      segments: [
        {
          id: "s1",
          visibility: { level: "public" as const, scopeId: null },
          content: [{ t: "text" as const, v: "Un texte." }],
        },
      ],
    };
    expect(validateBlockData("description", data)).toEqual(data);
  });
});
