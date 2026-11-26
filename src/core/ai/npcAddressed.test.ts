import { describe, expect, it } from "vitest";
import { estQuestionDirecte, npcAddressedBy } from "./npcAddressed";

const npcs = [
  { id: "edran", name: "Edran Vauclair" },
  { id: "mabelle", name: "Mabelle, du Fanal" },
  { id: "ourse", name: "Sergent Ourse" },
  { id: "wil", name: "Petit Wil" },
];

describe("npcAddressedBy — à qui le joueur parle, décidé par le code", () => {
  it("reconnaît un PNJ nommé dans une réplique entre guillemets", () => {
    expect(npcAddressedBy('je demande à Mabelle "Est ce que vous avez des chambres de libres ?"', npcs)).toBe("mabelle");
  });

  it("ignore la casse et les accents", () => {
    expect(npcAddressedBy("Je dis à EDRAN : « bonsoir »", npcs)).toBe("edran");
    expect(npcAddressedBy("je salue le sergent", npcs)).toBe("ourse");
  });

  it("une action sans parole ne désigne personne, même si un PNJ est nommé", () => {
    expect(npcAddressedBy("je m'assois à côté de Mabelle", npcs)).toBeNull();
    expect(npcAddressedBy("j'attaque Petit Wil", npcs)).toBeNull();
  });

  it("une parole sans nom reconnu ne désigne personne : le modèle choisit seul", () => {
    expect(npcAddressedBy("Je repose la question", npcs)).toBeNull();
    expect(npcAddressedBy("je demande au tavernier s'il a une chambre", npcs)).toBeNull();
  });

  it("un mot court ou un article du nom ne suffit jamais", () => {
    expect(npcAddressedBy("je demande du pain", npcs)).toBeNull();
  });

  it("le premier PNJ nommé dans la phrase l'emporte", () => {
    expect(npcAddressedBy("je demande à Wil, puis à Mabelle, où dormir ?", npcs)).toBe("wil");
  });

  it("le mot doit être entier : « Wilfried » n'est pas « Wil »", () => {
    expect(npcAddressedBy("je demande à Wilfried où dormir ?", npcs)).toBeNull();
  });

  it("aucun PNJ présent : personne", () => {
    expect(npcAddressedBy("je demande « bonsoir ? »", [])).toBeNull();
  });
});

describe("estQuestionDirecte — quand une réplique est due", () => {
  it("un point d'interrogation, ou un verbe qui demande, appelle une réponse", () => {
    expect(estQuestionDirecte("Je lui demane combien de temps ?")).toBe(true);
    expect(estQuestionDirecte("Je lui demande combien de temps de travail cela correspond")).toBe(true);
    expect(estQuestionDirecte("j'interroge le sergent sur la route")).toBe(true);
    expect(estQuestionDirecte("Je questionne Mabelle")).toBe(true);
  });

  it("une affirmation, un engagement, une salutation : aucune réplique n'est due", () => {
    expect(estQuestionDirecte("Ok alors je fais ces trois heures de travail")).toBe(false);
    expect(estQuestionDirecte("« Oui, j'aime mériter mon logement ! » et je l'aide à nettoyer")).toBe(false);
    expect(estQuestionDirecte("je salue Mabelle")).toBe(false);
  });

  it("« demande » au sens d'exiger compte aussi : la personne attend une réaction parlée", () => {
    expect(estQuestionDirecte("je demande une chambre")).toBe(true);
  });
});

