import { describe, expect, it } from "vitest";
import { mapThirdPartyEntries } from "./thirdPartyMapping";

describe("mapThirdPartyEntries", () => {
  it("associe une correspondance simple nom/description", () => {
    const result = mapThirdPartyEntries([{ titre: "Boule de feu", texte: "Une explosion ardente." }], {
      nameKey: "titre",
      descriptionKeys: ["texte"],
      entryType: "spell",
    });
    expect(result).toEqual([
      {
        name: "Boule de feu",
        entry_type: "spell",
        blocks: [{ block_type: "description", data: { segments: [{ text: "Une explosion ardente." }] } }],
      },
    ]);
  });

  it("concatene plusieurs cles en autant de segments, dans l'ordre demande", () => {
    const result = mapThirdPartyEntries([{ nom: "Gobelin", resume: "Petite créature verte.", tactique: "Fuit au corps à corps." }], {
      nameKey: "nom",
      descriptionKeys: ["resume", "tactique"],
      entryType: "monster",
    });
    expect(result[0].blocks[0].data.segments).toEqual([{ text: "Petite créature verte." }, { text: "Fuit au corps à corps." }]);
  });

  it("ecarte un enregistrement sans nom (absent, vide, ou non textuel) plutot que de produire une entree sans nom", () => {
    const result = mapThirdPartyEntries(
      [
        { titre: "Valide", texte: "ok" },
        { texte: "pas de titre" },
        { titre: "", texte: "titre vide" },
        { titre: "   ", texte: "titre blanc" },
        { titre: 42, texte: "titre non textuel" },
      ],
      { nameKey: "titre", descriptionKeys: ["texte"], entryType: "item" }
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valide");
  });

  it("ignore les cles de description absentes ou vides sans casser les autres", () => {
    const result = mapThirdPartyEntries([{ nom: "Sans description", vide: "" }], {
      nameKey: "nom",
      descriptionKeys: ["absente", "vide"],
      entryType: "feature",
    });
    expect(result[0].blocks[0].data.segments).toEqual([]);
  });

  it("rogne les espaces superflus du nom et des lignes de description", () => {
    const result = mapThirdPartyEntries([{ nom: "  Espacé  ", texte: "  aussi  " }], {
      nameKey: "nom",
      descriptionKeys: ["texte"],
      entryType: "item",
    });
    expect(result[0].name).toBe("Espacé");
    expect(result[0].blocks[0].data.segments).toEqual([{ text: "aussi" }]);
  });
});
