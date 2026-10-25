import { describe, expect, it } from "vitest";
import {
  ajouterLigne,
  deplacerLigne,
  modifierLigne,
  retirerLigne,
  suggererIntitules,
} from "./encadre";

const LISTES = {
  character: ["Race", "Âge", "Rôle", "Allégeance"],
  location: ["Région", "Population", "Dirigeant"],
};

describe("suggererIntitules", () => {
  it("ne propose rien pour un genre sans liste", () => {
    expect(suggererIntitules(LISTES, "item", "", [])).toEqual([]);
    expect(suggererIntitules(LISTES, undefined, "", [])).toEqual([]);
    expect(suggererIntitules(LISTES, "toString", "", [])).toEqual([]);
  });

  it("propose toute la liste du genre quand la saisie est vide", () => {
    expect(suggererIntitules(LISTES, "location", "", [])).toEqual(["Région", "Population", "Dirigeant"]);
    expect(suggererIntitules(LISTES, "character", "", [])).toEqual(["Race", "Âge", "Rôle", "Allégeance"]);
  });

  it("filtre par la saisie, sans tenir compte des accents ni de la casse", () => {
    expect(suggererIntitules(LISTES, "location", "reg", [])).toEqual(["Région"]);
    expect(suggererIntitules(LISTES, "character", "AG", [])).toEqual(["Âge"]);
    expect(suggererIntitules(LISTES, "character", "zzz", [])).toEqual([]);
  });

  it("ne repropose pas un intitulé déjà présent dans la fiche", () => {
    expect(suggererIntitules(LISTES, "location", "", ["population", "Région"])).toEqual(["Dirigeant"]);
  });

  it("ne repropose pas ce qui est déjà tapé en entier", () => {
    expect(suggererIntitules(LISTES, "location", "Région", [])).toEqual([]);
  });
});

describe("opérations sur les lignes", () => {
  const base = {
    __v: 1 as const,
    entries: [
      { label: "A", value: "1" },
      { label: "B", value: "2" },
      { label: "C", value: "3" },
    ],
  };

  it("ajoute une ligne, vide ou avec un intitulé", () => {
    expect(ajouterLigne(base).entries[3]).toEqual({ label: "", value: "" });
    expect(ajouterLigne(base, "Siège").entries[3]).toEqual({ label: "Siège", value: "" });
    expect(base.entries).toHaveLength(3);
  });

  it("retire une ligne", () => {
    expect(retirerLigne(base, 1).entries.map((e) => e.label)).toEqual(["A", "C"]);
  });

  it("modifie une ligne sans toucher aux autres", () => {
    const r = modifierLigne(base, 2, { value: "9" });
    expect(r.entries[2]).toEqual({ label: "C", value: "9" });
    expect(r.entries[0]).toBe(base.entries[0]);
  });

  it("déplace une ligne vers le haut et vers le bas", () => {
    expect(deplacerLigne(base, 0, 2).entries.map((e) => e.label)).toEqual(["B", "C", "A"]);
    expect(deplacerLigne(base, 2, 0).entries.map((e) => e.label)).toEqual(["C", "A", "B"]);
  });

  it("laisse la donnée telle quelle pour un déplacement sans effet", () => {
    expect(deplacerLigne(base, 1, 1)).toBe(base);
    expect(deplacerLigne(base, 0, 5)).toBe(base);
    expect(deplacerLigne(base, -1, 0)).toBe(base);
  });
});
