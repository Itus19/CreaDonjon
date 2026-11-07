import { describe, expect, it } from "vitest";
import { cleRegleBotte, cleRegleCompetence, premierePhrase, texteDescription, texteOption } from "./texteRegle";

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

describe("V3.1-174 — le texte d'une option, dans la description de son aptitude", () => {
  const PROIE_FR =
    "Vous recevez l’une des aptitudes suivantes au choix.\n**Briseur de hordes.** Une fois à chacun de vos tours, une nouvelle attaque.\n**Goût du sang.** Votre ténacité vient à bout des ennemis.";
  const PROIE_EN = "You gain one of the following feature options.\n  Colossus Slayer. Your tenacity can wear down foes.\n  Horde Breaker. Once on each of your turns.";

  it("le paragraphe qui commence par le nom de l'option, en gras (français) ou non (anglais)", () => {
    expect(texteOption(["Autre aptitude.", PROIE_FR], "Goût du sang")).toBe("Votre ténacité vient à bout des ennemis.");
    expect(texteOption([PROIE_FR], "Briseur de hordes")).toBe("Une fois à chacun de vos tours, une nouvelle attaque.");
    expect(texteOption([PROIE_EN], "Horde Breaker")).toBe("Once on each of your turns.");
  });

  it("une option introuvable n'a pas de texte", () => {
    expect(texteOption([PROIE_FR], "Tueur de géants")).toBe("");
  });

  it("la première phrase d'un texte, sans le gras", () => {
    expect(premierePhrase("**Protégez la nature.** Vous traquez des proies. Encore.")).toBe("Protégez la nature.");
    expect(premierePhrase("Sans point final")).toBe("Sans point final");
  });
});
