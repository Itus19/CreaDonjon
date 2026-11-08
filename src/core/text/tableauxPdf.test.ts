import { describe, expect, it } from "vitest";
import { blocEnTexte, decouperLignesEtTableaux, lireBloc, puceParLigne, type SpecBloc } from "./tableauxPdf";

/**
 * Les tableaux du SRD français, lus dans le texte extrait du PDF où chaque
 * rangée tient sur sa ligne (parfois deux), et réécrits en lignes « a | b ».
 */
const SOURCE = [
  "le type ou le détermine aléatoirement selon la table ",
  "suivante.",
  "1d10 Type de dégâts 1d10 Type de dégâts",
  "1 Acide 6 Nécrotiques",
  "2 Feu 7 Poison",
  "",
  "=== page 222 ===",
  "222 Document de Référence du Système 5.2.1",
  "3 Force 8 Psychiques",
  "Armure de vulnérabilité",
  "Sorts du Domaine de la Vie",
  "Niveau de ",
  "Clerc Sorts préparés",
  "3 aide, bénédiction, restauration partielle, ",
  "soins",
  "5 mot de guérison de groupe, retour à la vie",
  "Niveau 3 : Survivance",
];

describe("lireBloc", () => {
  it("deux tableaux côte à côte : remis en une colonne, les bruits de page sautés", () => {
    const spec: SpecBloc = { type: "tableau", entete: ["1d10 Type de dégâts 1d10 Type de dégâts"], colonnes: ["1d10", "Type de dégâts"], jusqua: "Armure de vulnérabilité", debutRangee: /^\d+ /, decoupe: /^(\d+) (.+?) (\d+) (.+)$/, parLigne: 2, rangees: 6 };
    const r = lireBloc(SOURCE, 0, spec);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.rangees).toEqual([["1", "Acide"], ["2", "Feu"], ["3", "Force"], ["6", "Nécrotiques"], ["7", "Poison"], ["8", "Psychiques"]]);
    expect(SOURCE[r.fin]).toBe("Armure de vulnérabilité");
  });

  it("une rangée sur plusieurs lignes est recollée ; le titre et l'en-tête sur deux lignes sont reconnus", () => {
    const spec: SpecBloc = { type: "tableau", titre: "Sorts du Domaine de la Vie", entete: ["Niveau de", "Clerc Sorts préparés"], colonnes: ["Niveau de Clerc", "Sorts préparés"], jusqua: "Niveau 3 : Survivance", debutRangee: /^\d+ /, decoupe: /^(\d+) (.+)$/, rangees: 2 };
    const r = lireBloc(SOURCE, 0, spec);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.rangees).toEqual([["3", "aide, bénédiction, restauration partielle, soins"], ["5", "mot de guérison de groupe, retour à la vie"]]);
    expect(blocEnTexte(spec, r.rangees)).toBe("**Sorts du Domaine de la Vie**\nNiveau de Clerc | Sorts préparés\n3 | aide, bénédiction, restauration partielle, soins\n5 | mot de guérison de groupe, retour à la vie");
  });

  it("refuse plutôt que deviner : rangées en trop ou en moins, rangée qui ne se découpe pas, en-tête introuvable", () => {
    const base: SpecBloc = { type: "tableau", titre: "Sorts du Domaine de la Vie", entete: ["Niveau de", "Clerc Sorts préparés"], colonnes: ["A", "B"], jusqua: "Niveau 3 : Survivance", debutRangee: /^\d+ /, decoupe: /^(\d+) (.+)$/, rangees: 3 };
    expect(lireBloc(SOURCE, 0, base).ok).toBe(false);
    expect(lireBloc(SOURCE, 0, { ...base, rangees: 2, decoupe: /^(\d+) (\d+)$/ }).ok).toBe(false);
    expect(lireBloc(SOURCE, 0, { ...base, entete: ["Introuvable"] }).ok).toBe(false);
  });

  it("des lignes simples (un profil) : reprises une par une jusqu'à la borne", () => {
    const r = lireBloc(["Mouche géante", "Bête de taille G", "CA 11", "Flasque de fer"], 0, { type: "lignes", debut: "Mouche géante", jusqua: "Flasque de fer" });
    if (!r.ok) throw new Error(r.erreur);
    expect(blocEnTexte({ type: "lignes", debut: "Mouche géante", jusqua: "Flasque de fer" }, r.rangees)).toBe("**Mouche géante**\nBête de taille G\nCA 11");
    expect(blocEnTexte({ type: "lignes", debut: "Mouche géante", jusqua: "Flasque de fer", gras: false }, r.rangees)).toBe("Mouche géante\nBête de taille G\nCA 11");
  });
});

describe("puceParLigne", () => {
  it("chaque puce sur sa ligne", () => {
    expect(puceParLigne("les sorts suivants : • amitié avec les animaux • terreur")).toBe("les sorts suivants :\n• amitié avec les animaux\n• terreur");
    expect(puceParLigne("rien à faire")).toBe("rien à faire");
  });
});

describe("decouperLignesEtTableaux", () => {
  it("deux lignes « a | b » ou plus font un tableau ; la première est l'en-tête", () => {
    expect(decouperLignesEtTableaux("Intro.\n**Titre**\nA | B\n1 | x\n2 | y\nFin.")).toEqual([
      { type: "ligne", texte: "Intro." },
      { type: "ligne", texte: "**Titre**" },
      { type: "tableau", colonnes: ["A", "B"], rangees: [["1", "x"], ["2", "y"]] },
      { type: "ligne", texte: "Fin." },
    ]);
  });

  it("une ligne isolée avec une barre reste du texte ; une rangée courte est complétée", () => {
    expect(decouperLignesEtTableaux("a | b")).toEqual([{ type: "ligne", texte: "a | b" }]);
    expect(decouperLignesEtTableaux("A | B | C\n1 | 2")).toEqual([{ type: "tableau", colonnes: ["A", "B", "C"], rangees: [["1", "2", ""]] }]);
  });

  it("le format des tableaux anglais du SRD (« Cleric Level | Prepared Spells ») se lit aussi", () => {
    const r = decouperLignesEtTableaux("Life Domain Spells\nCleric Level | Prepared Spells\n3 | Aid, Bless\n5 | Revivify\n");
    expect(r[1]).toEqual({ type: "tableau", colonnes: ["Cleric Level", "Prepared Spells"], rangees: [["3", "Aid, Bless"], ["5", "Revivify"]] });
  });
});
