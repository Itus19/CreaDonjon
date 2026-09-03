import { describe, expect, it } from "vitest";
import { formatSlotValuesForPrompt, renderGeneratorTemplate } from "./render";

describe("renderGeneratorTemplate", () => {
  it("remplace une cle connue par son texte", () => {
    expect(renderGeneratorTemplate("Bonjour {name}.", { name: "Aria" })).toBe("Bonjour Aria.");
  });

  it("remplace plusieurs cles distinctes", () => {
    expect(renderGeneratorTemplate("{prenom} {nom}", { prenom: "Aria", nom: "Ventfroid" })).toBe("Aria Ventfroid");
  });

  it("remplace toutes les occurrences d'une meme cle repetee", () => {
    expect(renderGeneratorTemplate("{name} le {name}", { name: "Grognard" })).toBe("Grognard le Grognard");
  });

  it("laisse une cle inconnue intacte, jamais une chaine vide ni une erreur", () => {
    expect(renderGeneratorTemplate("Bonjour {name}.", {})).toBe("Bonjour {name}.");
  });

  it("un gabarit sans aucun emplacement est renvoye tel quel", () => {
    expect(renderGeneratorTemplate("Texte fixe.", { name: "Aria" })).toBe("Texte fixe.");
  });

  it("ignore une cle fournie qui n'apparait pas dans le gabarit", () => {
    expect(renderGeneratorTemplate("Bonjour.", { name: "Aria" })).toBe("Bonjour.");
  });
});

describe("formatSlotValuesForPrompt", () => {
  it("met en forme un seul emplacement", () => {
    expect(formatSlotValuesForPrompt({ nom: "Auberge du Cerf Bleu" })).toBe("nom : Auberge du Cerf Bleu");
  });

  it("met en forme plusieurs emplacements, une ligne chacun, dans l'ordre fourni", () => {
    expect(formatSlotValuesForPrompt({ nom: "Auberge du Cerf Bleu", ambiance: "chaleureuse et bondee" })).toBe(
      "nom : Auberge du Cerf Bleu\nambiance : chaleureuse et bondee"
    );
  });

  it("une liste vide produit une chaine vide, jamais une erreur", () => {
    expect(formatSlotValuesForPrompt({})).toBe("");
  });
});
