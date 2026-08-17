import { describe, expect, it } from "vitest";
import { successProbability, skillProbabilityTable, DEFAULT_PROBABILITY_DCS } from "./probability";
import type { DerivedSheet, SkillResult } from "./sheet";
import { SKILLS } from "./sheet";

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

function fakeSkillResult(mod: number, rollState: SkillResult["rollState"]): SkillResult {
  return { mod, proficiency: "none", rollState, sources: [] };
}

describe("skillProbabilityTable", () => {
  it("produit une ligne par competence, avec les DD par defaut (10/15/20)", () => {
    const skills = Object.fromEntries(SKILLS.map((s) => [s, fakeSkillResult(2, "normal")])) as DerivedSheet["skills"];
    const table = skillProbabilityTable({ skills } as DerivedSheet);
    expect(table).toHaveLength(SKILLS.length);
    for (const row of table) {
      expect(Object.keys(row.probabilities).map(Number)).toEqual([...DEFAULT_PROBABILITY_DCS]);
    }
  });

  it("reprend le modificateur et l'etat du jet (avantage/desavantage) de chaque competence", () => {
    const skills = {
      ...Object.fromEntries(SKILLS.map((s) => [s, fakeSkillResult(0, "normal")])),
      stealth: fakeSkillResult(3, "advantage"),
    } as DerivedSheet["skills"];
    const table = skillProbabilityTable({ skills } as DerivedSheet);
    const stealthRow = table.find((r) => r.skill === "stealth")!;
    expect(stealthRow.mod).toBe(3);
    expect(stealthRow.rollState).toBe("advantage");
    expect(stealthRow.probabilities[15]).toBeCloseTo(successProbability(3, 15, "advantage"));
  });

  it("accepte une liste de DD personnalisee", () => {
    const skills = Object.fromEntries(SKILLS.map((s) => [s, fakeSkillResult(0, "normal")])) as DerivedSheet["skills"];
    const table = skillProbabilityTable({ skills } as DerivedSheet, [12]);
    expect(Object.keys(table[0].probabilities)).toEqual(["12"]);
  });
});
