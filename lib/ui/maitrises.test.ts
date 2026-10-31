import { describe, expect, it } from "vitest";
import { dedoublonnerMaitrises, libelleMaitrise } from "./maitrises";

describe("libelleMaitrise", () => {
  it("traduit la maîtrise d'outil de l'Acolyte", () => {
    expect(libelleMaitrise({ key: "Calligrapher's Supplies", name: "Calligrapher's Supplies" })).toBe("Matériel de calligraphe");
  });
  it("traduit la consigne du jeu du Soldat", () => {
    expect(libelleMaitrise({ key: 'Choose one kind of Gaming Set (see "Equipment")', name: 'Choose one kind of Gaming Set (see "Equipment")' })).toBe("Un jeu au choix");
  });
  it("laisse un nom déjà français", () => {
    expect(libelleMaitrise({ key: "spears", name: "Lance" })).toBe("Lance");
  });
  it("traduit une clé brute par le lexique des armes", () => {
    expect(libelleMaitrise({ key: "spears", name: "spears" })).toBe("Lances");
  });
});

describe("dedoublonnerMaitrises", () => {
  it("réunit deux sources de la même maîtrise", () => {
    const r = dedoublonnerMaitrises([
      { key: "spears", name: "Lance", source: "Druide" },
      { key: "spear", name: "Lance", source: "Elfe" },
    ]);
    expect(r).toEqual([{ key: "spears", name: "Lance", sources: ["Druide", "Elfe"] }]);
  });
  it("ne répète pas une source", () => {
    const r = dedoublonnerMaitrises([
      { key: "shields", name: "Boucliers", source: "Clerc" },
      { key: "shields", name: "Boucliers", source: "Clerc" },
    ]);
    expect(r[0].sources).toEqual(["Clerc"]);
  });
  it("garde les maîtrises distinctes", () => {
    expect(dedoublonnerMaitrises([{ key: "a", name: "Dague", source: "X" }, { key: "b", name: "Épée", source: "X" }])).toHaveLength(2);
  });
});
