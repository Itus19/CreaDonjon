import { describe, expect, it } from "vitest";
import { SeededRng } from "../dice/rng";
import type { Rng } from "../dice/rng";
import {
  drawMultiple,
  drawOnce,
  extractCascadeKeys,
  interpolateCascadeResults,
  parseDie,
  pickEntryForRoll,
  rollOnDie,
} from "./roll";
import { InvalidDieError, NoMatchingEntryError } from "./errors";
import type { RandomTableData, TableEntry } from "./types";

/** RNG deterministe : renvoie toujours la meme sequence de valeurs fournie, jamais aleatoire — pour verifier une entree precise sans dependre de l'implementation interne du RNG reel. */
function fixedRng(values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++ % values.length] };
}

describe("parseDie", () => {
  it("lit un nombre de faces depuis la notation de", () => {
    expect(parseDie("d20")).toBe(20);
    expect(parseDie("d100")).toBe(100);
    expect(parseDie("d6")).toBe(6);
  });

  it("leve InvalidDieError sur une notation invalide", () => {
    expect(() => parseDie("20")).toThrow(InvalidDieError);
    expect(() => parseDie("d0")).toThrow(InvalidDieError);
    expect(() => parseDie("d-5")).toThrow(InvalidDieError);
    expect(() => parseDie("foo")).toThrow(InvalidDieError);
  });
});

describe("rollOnDie", () => {
  it("lance un de via le RNG fourni, jamais Math.random()", () => {
    // nextInt(20) = 0 -> resultat 1 (le +1 du jet de de standard).
    expect(rollOnDie("d20", fixedRng([0]))).toBe(1);
    expect(rollOnDie("d20", fixedRng([19]))).toBe(20);
  });
});

const RUMOR_TABLE: RandomTableData = {
  key: "rumeurs",
  die: "d20",
  unique_draws: false,
  entries: [
    { range: { min: 1, max: 3 }, weight: 3, text: "Un enfant a disparu près du vieux moulin." },
    { range: { min: 4, max: 6 }, weight: 3, text: "Les gardes ont doublé leur patrouille de nuit." },
    { range: { min: 7, max: 20 }, weight: 14, text: "Une caravane de {table:marchands} cherche une escorte." },
  ],
};

describe("pickEntryForRoll", () => {
  it("trouve l'entree dont la plage contient le resultat", () => {
    expect(pickEntryForRoll(RUMOR_TABLE.entries, 2)?.text).toContain("enfant");
    expect(pickEntryForRoll(RUMOR_TABLE.entries, 5)?.text).toContain("patrouille");
    expect(pickEntryForRoll(RUMOR_TABLE.entries, 20)?.text).toContain("caravane");
  });

  it("renvoie null si aucune plage ne couvre le resultat", () => {
    expect(pickEntryForRoll(RUMOR_TABLE.entries, 0)).toBeNull();
  });
});

describe("extractCascadeKeys / interpolateCascadeResults", () => {
  it("extrait les cles de table referencees dans un texte de resultat", () => {
    expect(extractCascadeKeys("Une caravane de {table:marchands} cherche une escorte.")).toEqual(["marchands"]);
    expect(extractCascadeKeys("Aucune reference ici.")).toEqual([]);
    expect(extractCascadeKeys("{table:a} et {table:b}")).toEqual(["a", "b"]);
  });

  it("interpole les resultats deja tires a la place des references", () => {
    const results = new Map([["marchands", "des tisserands de Valdoria"]]);
    expect(interpolateCascadeResults("Une caravane de {table:marchands} cherche une escorte.", results)).toBe(
      "Une caravane de des tisserands de Valdoria cherche une escorte."
    );
  });

  it("laisse la reference telle quelle si sa cle n'a pas ete resolue", () => {
    expect(interpolateCascadeResults("{table:inconnue}", new Map())).toBe("{table:inconnue}");
  });
});

describe("drawOnce", () => {
  it("lance le de, trouve l'entree, releve ses references de cascade", () => {
    const draw = drawOnce(RUMOR_TABLE, fixedRng([19])); // nextInt(20)=19 -> roll 20
    expect(draw.roll).toBe(20);
    expect(draw.entry.text).toContain("caravane");
    expect(draw.cascadeKeys).toEqual(["marchands"]);
  });

  it("leve NoMatchingEntryError si aucune entree ne couvre le jet (table mal formee)", () => {
    const holedTable: RandomTableData = {
      key: "trouee",
      die: "d20",
      unique_draws: false,
      entries: [{ range: { min: 1, max: 1 }, weight: 1, text: "seule entree" }],
    };
    expect(() => drawOnce(holedTable, fixedRng([5]))).toThrow(NoMatchingEntryError); // roll = 6, hors plage
  });
});

const LOOT_TABLE: RandomTableData = {
  key: "butin",
  die: "d6",
  unique_draws: true,
  entries: [
    { range: { min: 1, max: 1 }, weight: 1, text: "une dague" },
    { range: { min: 2, max: 2 }, weight: 1, text: "une bourse" },
    { range: { min: 3, max: 3 }, weight: 1, text: "une gemme" },
  ],
};

describe("drawMultiple", () => {
  it("sans unique_draws, peut repeter la meme entree", () => {
    // nextInt(6) toujours 0 -> roll 1 -> toujours "une dague".
    const draws = drawMultiple({ ...RUMOR_TABLE, unique_draws: false }, 3, fixedRng([6])); // roll 7 -> toujours "caravane"
    expect(draws).toHaveLength(3);
    expect(draws.every((d) => d.entry.text.includes("caravane"))).toBe(true);
  });

  it("avec unique_draws, ne repete jamais une entree tant qu'il en reste d'inutilisees", () => {
    // Sequence qui tombe d'abord deux fois sur la meme entree (roll 1) avant de varier.
    const draws = drawMultiple(LOOT_TABLE, 3, fixedRng([0, 0, 1, 2]));
    expect(draws).toHaveLength(3);
    const texts = draws.map((d) => d.entry.text);
    expect(new Set(texts).size).toBe(3); // les trois entrees, chacune une seule fois
  });

  it("plafonne au nombre d'entrees distinctes si on demande plus que la table n'en contient", () => {
    const draws = drawMultiple(LOOT_TABLE, 10, fixedRng([0, 1, 2]));
    expect(draws).toHaveLength(3);
  });

  it("est deterministe pour une graine donnee (rejeu, meme discipline que les formules)", () => {
    const a = drawMultiple(LOOT_TABLE, 3, new SeededRng(42));
    const b = drawMultiple(LOOT_TABLE, 3, new SeededRng(42));
    expect(a.map((d) => d.entry.text)).toEqual(b.map((d) => d.entry.text));
  });
});

describe("TableEntry avec refs", () => {
  it("transporte des references d'entite/regle jusqu'au resultat du tirage", () => {
    const entry: TableEntry = {
      range: { min: 1, max: 3 },
      weight: 3,
      text: "Un enfant a disparu près du vieux moulin.",
      refs: [{ kind: "entity", id: "ent_moulin" }],
    };
    const table: RandomTableData = { key: "rumeurs", die: "d20", unique_draws: false, entries: [entry] };
    const draw = drawOnce(table, fixedRng([0]));
    expect(draw.entry.refs).toEqual([{ kind: "entity", id: "ent_moulin" }]);
  });
});
