import { describe, expect, it } from "vitest";
import {
  ajouterColonne,
  ajouterLigne,
  modifierCellule,
  nomColonneUnique,
  renommerColonne,
  retirerColonne,
  retirerLigne,
  valeurCellule,
} from "./tableauBloc";

const base = {
  __v: 1 as const,
  columns: ["Objet", "Prix"],
  rows: [
    { Objet: "Épée", Prix: "15 po" },
    { Objet: "Corde", Prix: "1 po" },
  ],
};

describe("nomColonneUnique", () => {
  it("garde un nom libre tel quel", () => {
    expect(nomColonneUnique("Poids", base.columns)).toBe("Poids");
  });
  it("suffixe un nom pris, jusqu'à en trouver un libre", () => {
    expect(nomColonneUnique("Prix", base.columns)).toBe("Prix 2");
    expect(nomColonneUnique("Prix", ["Prix", "Prix 2"])).toBe("Prix 3");
  });
  it("ne compte pas la colonne qu'on renomme contre elle-même", () => {
    expect(nomColonneUnique("Prix", base.columns, 1)).toBe("Prix");
  });
});

describe("colonnes", () => {
  it("ajoute une colonne au nom jamais en double", () => {
    expect(ajouterColonne(base).columns).toEqual(["Objet", "Prix", "Colonne 3"]);
    const r = ajouterColonne({ ...base, columns: ["Colonne 2", "B"] });
    expect(r.columns).toEqual(["Colonne 2", "B", "Colonne 3"]);
    const piege = ajouterColonne({ ...base, columns: ["Colonne 3", "B"] });
    expect(piege.columns).toEqual(["Colonne 3", "B", "Colonne 3 2"]);
  });

  it("retire une colonne et ses cellules", () => {
    const r = retirerColonne(base, 1);
    expect(r.columns).toEqual(["Objet"]);
    expect(r.rows).toEqual([{ Objet: "Épée" }, { Objet: "Corde" }]);
    expect(base.rows[0]).toEqual({ Objet: "Épée", Prix: "15 po" });
  });

  it("ignore une colonne inexistante", () => {
    expect(retirerColonne(base, 9)).toBe(base);
  });

  it("renomme une colonne en emportant ses cellules", () => {
    const r = renommerColonne(base, 1, "Coût");
    expect(r.columns).toEqual(["Objet", "Coût"]);
    expect(r.rows[0]).toEqual({ Objet: "Épée", Coût: "15 po" });
  });

  it("suffixe un renommage qui doublonne, sans écraser l'autre colonne", () => {
    const r = renommerColonne(base, 1, "Objet");
    expect(r.columns).toEqual(["Objet", "Objet 2"]);
    expect(r.rows[1]).toEqual({ Objet: "Corde", "Objet 2": "1 po" });
  });

  it("laisse la donnée telle quelle pour un nom vide ou inchangé", () => {
    expect(renommerColonne(base, 0, "   ")).toBe(base);
    expect(renommerColonne(base, 0, "Objet")).toBe(base);
  });
});

describe("lignes et cellules", () => {
  it("ajoute une ligne vide", () => {
    expect(ajouterLigne(base).rows).toHaveLength(3);
    expect(ajouterLigne(base).rows[2]).toEqual({});
  });

  it("retire une ligne", () => {
    expect(retirerLigne(base, 0).rows).toEqual([{ Objet: "Corde", Prix: "1 po" }]);
  });

  it("modifie une cellule sans toucher aux autres lignes", () => {
    const r = modifierCellule(base, 1, "Prix", "2 po");
    expect(r.rows[1]).toEqual({ Objet: "Corde", Prix: "2 po" });
    expect(r.rows[0]).toBe(base.rows[0]);
  });

  it("lit une cellule absente ou non textuelle comme vide", () => {
    expect(valeurCellule({}, "Prix")).toBe("");
    expect(valeurCellule({ Prix: 12 }, "Prix")).toBe("");
    expect(valeurCellule({ Prix: "3" }, "Prix")).toBe("3");
  });
});
