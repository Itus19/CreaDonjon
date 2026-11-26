import { describe, expect, it } from "vitest";
import { demandeLaCarte } from "./demandeCarte";

describe("demandeLaCarte — le joueur demande ce que le lieu sert ou ce que ça coûte", () => {
  it("reconnaît les demandes de repas, de chambre, de carte et de prix, paroles comprises", () => {
    for (const texte of [
      "je demande si il y a un petit déjeuné ou un repas de possible vu qu'il est midi",
      "\"oui avec plaisir ! C'est combien ?\"",
      "je regarde de plus près l'ardoise pour voir les différents prix",
      "je demande la carte",
      "je demande la carte des vins",
      "je commande une bière",
      "je voudrais une chambre pour la nuit",
      "qu'est-ce qu'il y a à manger ?",
    ]) {
      expect(demandeLaCarte(texte), texte).toBe(true);
    }
  });

  it("ne réagit pas à une action sans rapport", () => {
    for (const texte of ["je pousse la porte", "je regarde la carte du royaume au mur", "je dors", "je frappe le gobelin avec mon épée"]) {
      expect(demandeLaCarte(texte), texte).toBe(false);
    }
  });
});
