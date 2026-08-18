import { describe, expect, it } from "vitest";
import { renderGeneratorTemplate } from "./render";

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
