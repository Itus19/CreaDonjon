import { describe, expect, it } from "vitest";
import { ATTENTE_MIN_MS, REDUIT_QUERY, attenteMinimale, mouvementReduit } from "./animationDe";
import {
  ajouterSortie,
  delaisFigeage,
  etatRevelation,
  etatsLignes,
  exclusPourTirage,
  facesDe,
  resteASortir,
  sequenceDes,
  type Tirage,
} from "./tirageTable";

const tirage: Tirage = {
  text: "Des tisserands de Valdoria",
  refs: [],
  die: "d20",
  roll: 17,
  index: 4,
  subDraws: [
    { key: "marchands", die: "d6", roll: 3, text: "nains de Mirabar" },
    { key: "enseignes", die: "d4", roll: 4, text: "le Sanglier" },
  ],
};

describe("sequenceDes", () => {
  it("le dé de la table d'abord, puis chaque sous-tirage dans l'ordre", () => {
    expect(sequenceDes(tirage)).toEqual([
      { cle: null, faces: 20, valeur: 17, etiquette: "d20" },
      { cle: "marchands", faces: 6, valeur: 3, etiquette: "d6" },
      { cle: "enseignes", faces: 4, valeur: 4, etiquette: "d4" },
    ]);
  });
  it("sans cascade, un seul dé", () => {
    expect(sequenceDes({ ...tirage, subDraws: [] })).toHaveLength(1);
  });
  it("lit les faces d'une notation, 0 si elle est invalide", () => {
    expect(facesDe("d100")).toBe(100);
    expect(facesDe("20")).toBe(0);
    expect(facesDe("2d6")).toBe(0);
  });
});

describe("le figeage, un dé après l'autre", () => {
  it("espace les dés d'un pas", () => {
    expect(delaisFigeage(3, 110)).toEqual([110, 220, 330]);
    expect(delaisFigeage(0, 110)).toEqual([]);
  });
});

describe("le moment où la ligne s'allume", () => {
  it("jamais avant le dernier dé", () => {
    expect(etatRevelation(3, 0)).toEqual({ termine: false, ligneAllumee: false, texteEstompe: true });
    expect(etatRevelation(3, 1).ligneAllumee).toBe(false);
    expect(etatRevelation(3, 2).ligneAllumee).toBe(false);
  });
  it("à la fin du dernier dé, la ligne s'allume et le texte reprend sa couleur", () => {
    expect(etatRevelation(3, 3)).toEqual({ termine: true, ligneAllumee: true, texteEstompe: false });
  });
  it("avec un seul dé, elle s'allume dès qu'il est figé", () => {
    expect(etatRevelation(1, 0).ligneAllumee).toBe(false);
    expect(etatRevelation(1, 1).ligneAllumee).toBe(true);
  });
});

describe("lignes en « sans répétition »", () => {
  it("barre les lignes déjà sorties, mais pas la ligne en cours d'animation", () => {
    expect(etatsLignes(5, [1, 4], true, 4, false)).toEqual(["normale", "barree", "normale", "normale", "normale"]);
  });
  it("allume la ligne sortie à la fin, les précédentes restent barrées", () => {
    expect(etatsLignes(5, [1, 4], true, 4, true)).toEqual(["normale", "barree", "normale", "normale", "allumee"]);
  });
  it("sans « sans répétition », rien n'est barré", () => {
    expect(etatsLignes(3, [0, 1], false, 1, true)).toEqual(["normale", "allumee", "normale"]);
  });
  it("compte ce qu'il reste, et construit la liste à exclure", () => {
    expect(resteASortir(5, [1, 4, 4])).toBe(3);
    expect(exclusPourTirage([1, 4, 4], true)).toEqual([1, 4]);
    expect(exclusPourTirage([1, 4], false)).toEqual([]);
    expect(ajouterSortie([1], 4)).toEqual([1, 4]);
    expect(ajouterSortie([1, 4], 4)).toEqual([1, 4]);
  });
});

describe("mouvement réduit", () => {
  it("suit la préférence simulée", () => {
    const demande: string[] = [];
    const reduit = (q: string) => {
      demande.push(q);
      return { matches: true };
    };
    expect(mouvementReduit(reduit)).toBe(true);
    expect(demande).toEqual([REDUIT_QUERY]);
    expect(mouvementReduit(() => ({ matches: false }))).toBe(false);
  });
  it("sans matchMedia (rendu serveur), on n'anime pas… ni ne décide : faux", () => {
    expect(mouvementReduit(undefined)).toBe(false);
  });
  it("réduit : aucune attente ; sinon l'attente minimale", () => {
    expect(attenteMinimale(true)).toBe(0);
    expect(attenteMinimale(false)).toBe(ATTENTE_MIN_MS);
  });
});
