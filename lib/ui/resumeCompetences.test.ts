import { describe, expect, it } from "vitest";
import { resumerCompetences, type CompetenceResumee } from "./resumeCompetences";

const liste: CompetenceResumee[] = [
  { nom: "Acrobaties", mod: 1, proficiency: "none" },
  { nom: "Discrétion", mod: 7, proficiency: "expertise" },
  { nom: "Perception", mod: 4, proficiency: "proficient" },
  { nom: "Escamotage", mod: 7, proficiency: "proficient" },
];

describe("resumerCompetences", () => {
  it("compte les maîtrisées, expertises comprises", () => {
    expect(resumerCompetences(liste).maitrisees).toBe(3);
  });

  it("retient la meilleure valeur, la première en cas d'égalité", () => {
    expect(resumerCompetences(liste).meilleure).toEqual({ nom: "Discrétion", mod: 7 });
  });

  it("garde une meilleure valeur négative", () => {
    const r = resumerCompetences([
      { nom: "A", mod: -2, proficiency: "none" },
      { nom: "B", mod: -1, proficiency: "none" },
    ]);
    expect(r).toEqual({ maitrisees: 0, meilleure: { nom: "B", mod: -1 } });
  });

  it("n'invente rien pour une liste vide", () => {
    expect(resumerCompetences([])).toEqual({ maitrisees: 0, meilleure: null });
  });
});
