import { describe, expect, it } from "vitest";
import { routeSkillChoices } from "./skillChoiceRouting";

const fighter = { id: "fighter.skills", count: 2, options: ["athletics", "intimidation", "perception"] };
const skillful = { id: "skillful.skills", count: 1, options: ["athletics", "arcana", "perception", "stealth"] };

describe("routeSkillChoices (V3.1-4)", () => {
  it("envoie une competence au premier choix qui la propose et a encore de la place", () => {
    const map = routeSkillChoices([fighter, skillful], {});
    expect(map.get("athletics")?.id).toBe("fighter.skills");
    expect(map.get("arcana")?.id).toBe("skillful.skills");
  });

  it("passe au choix suivant quand le premier est plein", () => {
    const map = routeSkillChoices([fighter, skillful], { "fighter.skills": ["athletics", "intimidation"] });
    expect(map.get("perception")?.id).toBe("skillful.skills");
    // Deja retenue par la classe : elle reste a la classe, pour pouvoir la decocher.
    expect(map.get("athletics")?.id).toBe("fighter.skills");
  });

  it("garde une competence au choix qui l'a deja retenue, meme s'il n'est pas le premier", () => {
    const map = routeSkillChoices([fighter, skillful], { "skillful.skills": ["athletics"] });
    expect(map.get("athletics")?.id).toBe("skillful.skills");
  });

  it("retombe sur le premier choix qui la propose quand tous sont pleins", () => {
    const map = routeSkillChoices([fighter, skillful], { "fighter.skills": ["athletics", "intimidation"], "skillful.skills": ["arcana"] });
    expect(map.get("perception")?.id).toBe("fighter.skills");
    expect(map.get("stealth")?.id).toBe("skillful.skills");
  });

  it("ignore une valeur de choix qui n'est pas une liste", () => {
    const map = routeSkillChoices([fighter], { "fighter.skills": "athletics" });
    expect(map.get("athletics")?.id).toBe("fighter.skills");
  });
});
