import { describe, expect, it } from "vitest";
import { bestIndices, checkLines, PROBABILITY_DC_MAX, PROBABILITY_DC_MIN, successProbability } from "./probability";
import { ABILITIES, characterSheet, SKILL_ABILITIES, SKILLS, type ActiveEffect, type CharacterBuild, type ResolvedRuleset } from "./sheet";

describe("successProbability", () => {
  it("calcule un jet normal : DD 10, mod 0 -> 11 resultats sur 20 (10 a 20)", () => {
    expect(successProbability(0, 10, "normal")).toBeCloseTo(11 / 20);
  });

  it("calcule un jet normal : DD 20, mod 0 -> seul le 20 naturel reussit", () => {
    expect(successProbability(0, 20, "normal")).toBeCloseTo(1 / 20);
  });

  it("un DD hors de portee du de (meme au 20 naturel) donne une probabilite nulle", () => {
    expect(successProbability(0, 25, "normal")).toBe(0);
  });

  it("un DD toujours atteint (meme au 1 naturel) donne une probabilite de 1", () => {
    expect(successProbability(10, 5, "normal")).toBe(1);
  });

  it("le modificateur deplace le seuil : DD 15, mod +5 equivaut a DD 10, mod 0", () => {
    expect(successProbability(5, 15, "normal")).toBeCloseTo(successProbability(0, 10, "normal"));
  });

  it("l'avantage augmente la probabilite par rapport a un jet normal", () => {
    // DD 11, mod 0 : normal = 10/20 = 0.5 ; avantage = 1 - (10/20)^2 = 0.75
    expect(successProbability(0, 11, "advantage")).toBeCloseTo(0.75);
  });

  it("le desavantage diminue la probabilite par rapport a un jet normal", () => {
    // DD 11, mod 0 : desavantage = (10/20)^2 = 0.25
    expect(successProbability(0, 11, "disadvantage")).toBeCloseTo(0.25);
  });

  it("avantage et desavantage restent bornes entre 0 et 1 aux extremes", () => {
    expect(successProbability(0, 25, "advantage")).toBe(0);
    expect(successProbability(10, 5, "disadvantage")).toBe(1);
  });
});

// --- V3.1-46 : la matrice (6 jets de caractéristique + 18 compétences) ----

const BARD = { key: "bard", label: "Barde", hitDie: 8, savingThrowProficiencies: ["dex", "cha"] as const };
const touche = {
  key: "jack",
  label: "Touche-à-tout",
  source: "class:bard",
  modifiers: [{ target: "check", op: "half_proficiency" as const, layer: 3 as const, source: "class:bard", label: "Touche-à-tout" }],
};
const avantageForce: ActiveEffect = {
  key: "bulls_strength",
  label: "Force du taureau",
  modifiers: [{ target: "check.str", op: "advantage", layer: 7, source: "effect:bulls", label: "Force du taureau" }],
};
const ruleset: ResolvedRuleset = { classes: { bard: BARD }, features: { jack: touche } };
function barde(featureKeys: string[], effets: ActiveEffect[] = []) {
  const build: CharacterBuild = {
    species: "human",
    classes: [{ key: "bard", level: 1 }],
    abilities: { assigned: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 } },
    featureKeys,
  };
  return characterSheet(build, ruleset, [], effets);
}

describe("checkLines", () => {
  it("donne les six caractéristiques, puis les dix-huit compétences, dans l'ordre", () => {
    const lignes = checkLines(barde([]));
    expect(lignes).toHaveLength(6 + 18);
    expect(lignes.slice(0, 6).map((l) => l.key)).toEqual([...ABILITIES]);
    expect(lignes.slice(6).map((l) => l.key)).toEqual([...SKILLS]);
    expect(lignes[0]).toMatchObject({ kind: "ability", ability: "str" });
    expect(lignes[6]).toMatchObject({ kind: "skill", ability: SKILL_ABILITIES[SKILLS[0]] });
  });

  it("jet de Force sans maîtrise avec touche-à-tout : +1 au niveau 1, donc 12 chances sur 20 à DD 10", () => {
    const force = checkLines(barde(["jack"]))[0];
    expect(force).toMatchObject({ key: "str", mod: 1, proficiency: "half", rollState: "normal" });
    expect(force.sources).toContainEqual({ label: "Touche-à-tout", value: 1 });
    expect(successProbability(force.mod, 10, force.rollState)).toBeCloseTo(12 / 20);
  });

  it("jet de Force avec touche-à-tout et avantage : 1 − (8/20)² à DD 10", () => {
    const force = checkLines(barde(["jack"], [avantageForce]))[0];
    expect(force.rollState).toBe("advantage");
    expect(successProbability(force.mod, 10, force.rollState)).toBeCloseTo(1 - (8 / 20) ** 2);
  });

  it("aux bornes du DD : DD 5 réussit sauf sur 1 à 3 avec +1 ; DD 30 est hors d'atteinte avec +1", () => {
    const force = checkLines(barde(["jack"]))[0];
    expect(successProbability(force.mod, PROBABILITY_DC_MIN, force.rollState)).toBeCloseTo(17 / 20);
    expect(successProbability(force.mod, PROBABILITY_DC_MAX, force.rollState)).toBe(0);
    expect([PROBABILITY_DC_MIN, PROBABILITY_DC_MAX]).toEqual([5, 30]);
  });
});

describe("bestIndices", () => {
  it("rend toutes les colonnes à égalité au meilleur", () => {
    expect(bestIndices([0.5, 0.75, 0.75, 0.2])).toEqual([1, 2]);
  });
  it("rend une liste vide sans colonne", () => {
    expect(bestIndices([])).toEqual([]);
  });
});
