import { describe, expect, it } from "vitest";
import {
  FAMILLES_PALETTE,
  TYPES_HORS_PALETTE,
  annonceReordonnancement,
  famillesAjoutables,
  positionApresDeplacement,
} from "./ficheBlocs";

describe("FAMILLES_PALETTE", () => {
  it("range les types en quatre familles, dans l'ordre du ticket V3.1-63", () => {
    expect(FAMILLES_PALETTE.map((f) => f.cle)).toEqual(["recit", "personnage", "psyche", "outils"]);
    expect(FAMILLES_PALETTE[0].types).toEqual(["text", "infobox", "image", "custom_table", "timeline"]);
    expect(FAMILLES_PALETTE[1].types).toEqual(["character", "inventory", "spellcasting", "resources", "statblock"]);
    expect(FAMILLES_PALETTE[2].types).toEqual(["personality", "relationship", "worldview", "relations_graph", "genealogy"]);
    expect(FAMILLES_PALETTE[3].types).toEqual(["random_table", "quest", "music", "map"]);
  });

  it("n'expose ni generator, ni note_tree, ni session_journal_meta", () => {
    const tous = FAMILLES_PALETTE.flatMap((f) => f.types);
    for (const exclu of ["generator", "note_tree", "session_journal_meta"]) {
      expect(tous).not.toContain(exclu);
      expect(TYPES_HORS_PALETTE).toContain(exclu);
    }
  });

  it("ne répète aucun type", () => {
    const tous = FAMILLES_PALETTE.flatMap((f) => f.types);
    expect(new Set(tous).size).toBe(tous.length);
  });
});

describe("famillesAjoutables", () => {
  it("retire personnalité et convictions dès qu'un exemplaire existe", () => {
    const familles = famillesAjoutables([{ blockType: "personality" }, { blockType: "worldview" }]);
    const tous = familles.flatMap((f) => f.types);
    expect(tous).not.toContain("personality");
    expect(tous).not.toContain("worldview");
    expect(tous).toContain("relationship");
  });

  it("limite aux types permis et écarte les familles vides", () => {
    const familles = famillesAjoutables([], ["text", "map"]);
    expect(familles.map((f) => f.cle)).toEqual(["recit", "outils"]);
    expect(familles[0].types).toEqual(["text"]);
    expect(familles[1].types).toEqual(["map"]);
  });
});

describe("positionApresDeplacement", () => {
  const ids = ["a", "b", "c", "d"];
  it("donne la position (1 = premier) et le total après le déplacement", () => {
    expect(positionApresDeplacement(ids, "a", "c")).toEqual({ position: 3, total: 4 });
    expect(positionApresDeplacement(ids, "d", "b")).toEqual({ position: 2, total: 4 });
  });
  it("garde la position quand la cible est introuvable ou identique", () => {
    expect(positionApresDeplacement(ids, "b", "b")).toEqual({ position: 2, total: 4 });
    expect(positionApresDeplacement(ids, "b", "zzz")).toEqual({ position: 2, total: 4 });
  });
  it("renvoie null pour un bloc inconnu", () => {
    expect(positionApresDeplacement(ids, "zzz", "a")).toBeNull();
  });
});

describe("annonceReordonnancement", () => {
  const ids = ["a", "b", "c"];
  const libelles: Record<string, string> = { a: "En bref", b: "Description", c: "Histoire" };
  it("annonce la prise du bloc", () => {
    expect(annonceReordonnancement("prise", ids, libelles, "b", "b")).toEqual({
      cle: "prise",
      bloc: "Description",
      position: 2,
      total: 3,
    });
  });
  it("annonce le déplacement avec la nouvelle position", () => {
    expect(annonceReordonnancement("deplace", ids, libelles, "a", "c")).toEqual({
      cle: "deplace",
      bloc: "En bref",
      position: 3,
      total: 3,
    });
  });
  it("annonce la pose et l'annulation", () => {
    expect(annonceReordonnancement("posee", ids, libelles, "c", "a")?.cle).toBe("posee");
    expect(annonceReordonnancement("annulee", ids, libelles, "c", null)).toEqual({
      cle: "annulee",
      bloc: "Histoire",
      position: 3,
      total: 3,
    });
  });
  it("renvoie null quand le bloc est inconnu", () => {
    expect(annonceReordonnancement("prise", ids, libelles, "zzz", null)).toBeNull();
  });
});
