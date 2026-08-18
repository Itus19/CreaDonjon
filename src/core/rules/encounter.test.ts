import { describe, expect, it } from "vitest";
import { encounterBudget, encounterCost, parseEncounterBudgetRows, type EncounterBudgetRow } from "./encounter";

// Table "Budget de PX par personnage" (SRD 5.2.1, § « Difficulté d'une
// rencontre de combat ») — 20 lignes verifiees mot pour mot dans
// data/srd/fr-source/srd-5.2.1-fr.txt, lignes 20805-20829. Un extrait
// suffit pour les tests (niveaux 1, 3, 15, exactement ceux des exemples
// officiels du texte).
const TABLE: EncounterBudgetRow[] = [
  { level: 1, low: 50, moderate: 75, high: 100 },
  { level: 3, low: 150, moderate: 225, high: 400 },
  { level: 15, low: 3300, moderate: 5400, high: 7800 },
];

describe("encounterBudget", () => {
  // Les trois cas dores sont les trois exemples donnes MOT POUR MOT par le
  // texte officiel (meme section) — jamais une valeur inventee.
  it("exemple 1 du SRD : groupe de 4 personnages de niveau 1, difficulte faible -> 200 PX", () => {
    expect(encounterBudget([1, 1, 1, 1], "low", TABLE)).toBe(200);
  });

  it("exemple 2 du SRD : groupe de 5 personnages de niveau 3, difficulte moderee -> 1125 PX", () => {
    expect(encounterBudget([3, 3, 3, 3, 3], "moderate", TABLE)).toBe(1125);
  });

  it("exemple 3 du SRD : groupe de 6 personnages de niveau 15, difficulte elevee -> 46800 PX", () => {
    expect(encounterBudget([15, 15, 15, 15, 15, 15], "high", TABLE)).toBe(46800);
  });

  it("un groupe de niveaux melanges additionne le seuil propre a chaque personnage", () => {
    // 2 PJ niveau 1 (50 chacun) + 1 PJ niveau 3 (150) = 250, coherent avec
    // la formule "seuil x nombre de PJ" du texte quand le niveau est uniforme.
    expect(encounterBudget([1, 1, 3], "low", TABLE)).toBe(250);
  });

  it("un niveau absent de la table leve une erreur explicite, jamais un budget invente", () => {
    expect(() => encounterBudget([2], "low", TABLE)).toThrow(/niveau/i);
  });
});

describe("encounterCost", () => {
  it("exemple 1 du SRD : 1 combattant gobelours a 200 PX -> 200", () => {
    expect(encounterCost([{ xp: 200, count: 1 }])).toBe(200);
  });

  it("exemple 1 du SRD : 2 guepes geantes a 100 PX chacune -> 200", () => {
    expect(encounterCost([{ xp: 100, count: 2 }])).toBe(200);
  });

  it("exemple 1 du SRD : 6 rats geants a 25 PX chacun -> 150", () => {
    expect(encounterCost([{ xp: 25, count: 6 }])).toBe(150);
  });

  it("exemple 2 du SRD : 2 druides (450 PX) + 9 striges (25 PX) -> 1125", () => {
    expect(encounterCost([{ xp: 450, count: 2 }, { xp: 25, count: 9 }])).toBe(1125);
  });

  it("exemple 3 du SRD : 2 dragons rouges adultes (18000 PX) + 2 geants du feu (5000 PX) -> 46000", () => {
    expect(encounterCost([{ xp: 18000, count: 2 }, { xp: 5000, count: 2 }])).toBe(46000);
  });

  it("une liste vide coute 0", () => {
    expect(encounterCost([])).toBe(0);
  });
});

describe("parseEncounterBudgetRows", () => {
  it("lit les lignes du bloc custom_table (en-tetes francais, memes cles que colonnes affichees)", () => {
    const rows = [
      { Niveau: "1", Faible: "50", Modérée: "75", Élevée: "100" },
      { Niveau: "2", Faible: "100", Modérée: "150", Élevée: "200" },
    ];
    expect(parseEncounterBudgetRows(rows)).toEqual([
      { level: 1, low: 50, moderate: 75, high: 100 },
      { level: 2, low: 100, moderate: 150, high: 200 },
    ]);
  });

  it("ignore une ligne dont un champ numerique est illisible plutot que de produire NaN", () => {
    const rows = [{ Niveau: "1", Faible: "cinquante", Modérée: "75", Élevée: "100" }];
    expect(parseEncounterBudgetRows(rows)).toEqual([]);
  });
});
