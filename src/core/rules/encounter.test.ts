import { describe, expect, it } from "vitest";
import {
  encounterBudget,
  encounterCost,
  formatChallengeRating,
  generateRandomEncounter,
  parseEncounterBudgetRows,
  type EncounterBudgetRow,
  type EncounterMonsterOption,
} from "./encounter";
import { SeededRng } from "../dice/rng";

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

describe("formatChallengeRating", () => {
  it("affiche les fractions usuelles du SRD", () => {
    expect(formatChallengeRating(0.125)).toBe("1/8");
    expect(formatChallengeRating(0.25)).toBe("1/4");
    expect(formatChallengeRating(0.5)).toBe("1/2");
  });

  it("affiche un facteur entier tel quel", () => {
    expect(formatChallengeRating(0)).toBe("0");
    expect(formatChallengeRating(1)).toBe("1");
    expect(formatChallengeRating(20)).toBe("20");
  });
});

describe("generateRandomEncounter", () => {
  const POOL: EncounterMonsterOption[] = [
    { entryKey: "goblin", xp: 50 },
    { entryKey: "orc", xp: 100 },
    { entryKey: "owlbear", xp: 700 },
  ];

  it("un budget de zero ne genere aucun participant", () => {
    expect(generateRandomEncounter(0, POOL, new SeededRng(1))).toEqual([]);
  });

  it("un pool vide ne genere aucun participant", () => {
    expect(generateRandomEncounter(500, [], new SeededRng(1))).toEqual([]);
  });

  it("ne depasse jamais le budget cible, quelle que soit la graine", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = generateRandomEncounter(500, POOL, new SeededRng(seed));
      const cost = result.reduce((sum, p) => {
        const option = POOL.find((o) => o.entryKey === p.entryKey)!;
        return sum + option.xp * p.count;
      }, 0);
      expect(cost).toBeLessThanOrEqual(500);
    }
  });

  it("aucune option ne rentrant dans le budget -> aucun participant", () => {
    expect(generateRandomEncounter(40, POOL, new SeededRng(1))).toEqual([]);
  });

  it("une seule option qui rentre exactement -> la sature completement", () => {
    const result = generateRandomEncounter(150, [{ entryKey: "goblin", xp: 50 }], new SeededRng(1));
    expect(result).toEqual([{ entryKey: "goblin", count: 3 }]);
  });

  it("meme graine -> meme resultat (reproductible)", () => {
    const a = generateRandomEncounter(500, POOL, new SeededRng(42));
    const b = generateRandomEncounter(500, POOL, new SeededRng(42));
    expect(a).toEqual(b);
  });

  it("ecarte une option a PX nul ou negatif avant tirage (jamais de boucle infinie)", () => {
    const result = generateRandomEncounter(100, [{ entryKey: "gratuit", xp: 0 }], new SeededRng(1));
    expect(result).toEqual([]);
  });
});
