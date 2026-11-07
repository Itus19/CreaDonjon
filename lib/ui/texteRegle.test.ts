import { describe, expect, it } from "vitest";
import { cleRegleBotte, cleRegleCompetence, texteDescription } from "./texteRegle";

describe("V3.1-173 — clés et texte des fiches de règle de l'assistant", () => {
  it("la fiche d'une compétence : `skill-` puis l'index du SRD (tirets)", () => {
    expect(cleRegleCompetence("perception")).toBe("skill-perception");
    expect(cleRegleCompetence("animal_handling")).toBe("skill-animal-handling");
    expect(cleRegleCompetence("sleight_of_hand")).toBe("skill-sleight-of-hand");
  });

  it("la fiche d'une botte : `weapon-mastery-` puis sa clé", () => {
    expect(cleRegleBotte("nick")).toBe("weapon-mastery-nick");
  });

  it("le texte du bloc description : ses segments bout à bout", () => {
    const blocs = [
      { blockType: "custom_table", data: {} },
      { blockType: "description", data: { segments: [{ text: "Apaiser un animal." }, { text: "Ou le dresser." }] } },
    ];
    expect(texteDescription(blocs)).toBe("Apaiser un animal. Ou le dresser.");
  });

  it("sans bloc description, ou un bloc illisible : rien", () => {
    expect(texteDescription(undefined)).toBe("");
    expect(texteDescription([{ blockType: "description", data: { segments: "x" } }])).toBe("");
    expect(texteDescription([{ blockType: "description", data: { segments: [{ text: 3 }] } }])).toBe("");
  });
});
