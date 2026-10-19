import { describe, expect, it } from "vitest";
import {
  budgetDuGroupe,
  filtrerCatalogue,
  membresComptes,
  niveauMoyenArrondi,
  typeDeBase,
  typesDuCatalogue,
} from "./atelierRencontres";

const pj = (entityId: string, name: string, level: number, shares: { low: number; moderate: number; high: number } | null) => ({
  entityId,
  name,
  level,
  shares,
});

const groupe = [
  pj("a", "Aldric Vent-Fort", 3, { low: 100, moderate: 150, high: 200 }),
  pj("b", "Brisa", 5, { low: 300, moderate: 500, high: 700 }),
  pj("c", "Sans fiche", 0, null),
];

describe("membresComptes", () => {
  it("garde les cochés dont la part n'est pas nulle", () => {
    expect(membresComptes(groupe, new Set()).map((m) => m.entityId)).toEqual(["a", "b"]);
    expect(membresComptes(groupe, new Set(["a"])).map((m) => m.entityId)).toEqual(["b"]);
  });
});

describe("budgetDuGroupe", () => {
  it("additionne les parts de chaque palier des PJ présents", () => {
    expect(budgetDuGroupe(groupe, new Set())).toEqual({ low: 400, moderate: 650, high: 900 });
  });
  it("suit un PJ décoché", () => {
    expect(budgetDuGroupe(groupe, new Set(["b"]))).toEqual({ low: 100, moderate: 150, high: 200 });
  });
  it("ignore un PJ sans part, même coché", () => {
    expect(budgetDuGroupe([groupe[2]], new Set())).toEqual({ low: 0, moderate: 0, high: 0 });
  });
});

describe("niveauMoyenArrondi", () => {
  it("arrondit la moyenne", () => {
    expect(niveauMoyenArrondi([3, 4])).toBe(4);
    expect(niveauMoyenArrondi([3, 3, 4])).toBe(3);
  });
  it("borne entre 1 et 20", () => {
    expect(niveauMoyenArrondi([])).toBe(1);
    expect(niveauMoyenArrondi([25, 30])).toBe(20);
  });
});

const monstres = [
  { key: "gobelin", name: "Gobelin", type: "humanoid" },
  { key: "loup", name: "Loup", type: "beast" },
  { key: "ogre", name: "Ogre", type: "giant" },
  { key: "loup-garou", name: "Loup-garou", type: "humanoid" },
];

describe("filtrerCatalogue", () => {
  it("cherche sans casse dans le nom", () => {
    expect(filtrerCatalogue(monstres, "LOUP", null).map((m) => m.key)).toEqual(["loup", "loup-garou"]);
  });
  it("filtre par type et combine avec la recherche", () => {
    expect(filtrerCatalogue(monstres, "", "humanoid").map((m) => m.key)).toEqual(["gobelin", "loup-garou"]);
    expect(filtrerCatalogue(monstres, "loup", "humanoid").map((m) => m.key)).toEqual(["loup-garou"]);
  });
  it("rend tout sans critère", () => {
    expect(filtrerCatalogue(monstres, "  ", null)).toHaveLength(4);
  });
});

describe("typeDeBase", () => {
  it("ramène un type à sa base, en minuscules, sans sous-type (données SRD hétérogènes)", () => {
    expect(typeDeBase("Humanoid (Cleric)")).toBe("humanoid");
    expect(typeDeBase("Beast (Dinosaur)")).toBe("beast");
    expect(typeDeBase(" Aberration ")).toBe("aberration");
    expect(typeDeBase("humanoid")).toBe("humanoid");
  });
  it("une nuée est une nuée, quelle que soit sa créature", () => {
    expect(typeDeBase("Swarm of Tiny Beast")).toBe("swarm");
  });
});

describe("typesDuCatalogue", () => {
  it("liste les types de base distincts, triés", () => {
    expect(typesDuCatalogue(monstres)).toEqual(["beast", "giant", "humanoid"]);
    expect(typesDuCatalogue([...monstres, { key: "pretre", name: "Prêtre", type: "Humanoid (Cleric)" }])).toEqual(["beast", "giant", "humanoid"]);
  });
});

describe("filtrerCatalogue par type de base", () => {
  it("un sous-type passe le filtre de son type", () => {
    const avecPretre = [...monstres, { key: "pretre", name: "Prêtre", type: "Humanoid (Cleric)" }];
    expect(filtrerCatalogue(avecPretre, "", "humanoid").map((m) => m.key)).toEqual(["gobelin", "loup-garou", "pretre"]);
  });
});
