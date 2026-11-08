import { describe, expect, it } from "vitest";
import { lireEnTeteDeSort } from "./enTeteSortPdf";

/** V3.1-189 — l'en-tête d'un sort, relu dans le texte extrait du PDF du SRD français. */
describe("lireEnTeteDeSort", () => {
  it("2024 : une composante matérielle sur deux lignes, la seconde commençant par un chiffre (le cas de divination)", () => {
    const l = ["Divination", "", "Divination du 4e niveau (Clerc, Druide, Magicien)", "Temps d’incantation : action ou rituel", "Portée : personnelle", "Composantes : V, S, M (encens d’une valeur minimale de ", "", "25 po, que le sort détruit)", "Durée : instantanée", "", "=== page 138 ===", "Domination de monstre"];
    expect(lireEnTeteDeSort(l, "Divination")).toEqual({
      casting_time: "action ou rituel",
      range: "personnelle",
      components: ["V", "S", "M"],
      material: "encens d’une valeur minimale de 25 po, que le sort détruit",
      duration: "instantanée",
      concentration: false,
      ritual: true,
    });
  });

  it("2014 : un pied de page au milieu de l'en-tête, le rituel sur la ligne d'école, la concentration dans la durée", () => {
    const l = [
      "Métamorphose animale",
      "Transmutation du 8e niveau (rituel)",
      "Temps d’incantation : 1 action",
      "Portée : 9 m",
      "Composantes : V, S",
      "",
      "=== page 180 ===",
      "Interdit à la revente. Vous êtes autorisés à imprimer ou photocopier ",
      "ce document pour votre strict usage personnel. Document de Référence du Système 5.1 180",
      "Durée : concentration, jusqu’à 24 heures",
      "Votre magie transforme autrui en bête.",
    ];
    expect(lireEnTeteDeSort(l, "Métamorphose animale")).toEqual({ casting_time: "1 action", range: "9 m", components: ["V", "S"], duration: "concentration, jusqu’à 24 heures", concentration: true, ritual: true });
  });

  it("une durée sur deux lignes ; le texte du sort, qui commence par une majuscule, ne s'y colle pas", () => {
    const l = ["Lueur", "Évocation mineure (Clerc)", "Temps d’incantation : action", "Portée : 18 m", "Composantes : V", "Durée : Concentration, jusqu’à 10 ", "minutes", "Une lueur apparaît."];
    expect(lireEnTeteDeSort(l, "Lueur")?.duration).toBe("Concentration, jusqu’à 10 minutes");
  });

  it("2014 : « Sort mineur de transmutation » est une ligne d'école", () => {
    const l = ["Crosse des druides", "Sort mineur de transmutation", "Temps d’incantation : 1 action bonus", "Portée : contact", "Composantes : V, S, M (du gui, une feuille de trèfle et une massue ou un bâton)", "Durée : 1 minute", "Le bois"];
    expect(lireEnTeteDeSort(l, "Crosse des druides")).toMatchObject({ casting_time: "1 action bonus", duration: "1 minute" });
  });

  it("une valeur qui finit sur « ou » continue, même si la ligne suivante commence par un chiffre", () => {
    const l = ["Croissance végétale", "Transmutation du 3e niveau (Barde, Druide)", "Temps d’incantation : action (Embroussaillement) ou ", "8 heures (Fertilisation)", "Portée : 45 m", "Composantes : V, S", "Durée : instantanée", "Ce sort gorge les plantes."];
    expect(lireEnTeteDeSort(l, "Croissance végétale")?.casting_time).toBe("action (Embroussaillement) ou 8 heures (Fertilisation)");
  });

  it("un titre suivi, dans une liste, de l'en-tête d'un AUTRE sort n'est pas pris : la ligne d'école doit suivre le titre", () => {
    const l = ["Communion avec la nature", "Passage par les arbres", "Lenteur", "Transmutation du 3e niveau", "Temps d’incantation : 1 action", "Portée : 36 m", "Composantes : V, S, M (une goutte de mélasse)", "Durée : concentration, jusqu’à 1 minute", "Communion avec la nature", "Divination du 5e niveau (rituel)", "Temps d’incantation : 1 minute", "Portée : personnelle", "Composantes : V, S", "Durée : instantanée", "Vous ne faites plus qu’un"];
    expect(lireEnTeteDeSort(l, "Communion avec la nature")).toMatchObject({ casting_time: "1 minute", range: "personnelle", ritual: true });
    expect(lireEnTeteDeSort(l, "Passage par les arbres")).toBeNull();
  });

  it("le titre qui figure aussi dans une liste de sorts : seule l'occurrence suivie d'un en-tête compte ; absent : null", () => {
    const l = ["Lumières dansantes", "Main du mage", "Message", "Lumières dansantes", "Sort mineur d’évocation", "Temps d’incantation : 1 action", "Portée : 36 m", "Composantes : V, S, M (un peu de phosphore ", "ou d’orme blanc, ou un ver luisant)", "Durée : concentration, jusqu’à 1 minute", "Vous créez"];
    expect(lireEnTeteDeSort(l, "Lumières dansantes")).toMatchObject({ material: "un peu de phosphore ou d’orme blanc, ou un ver luisant", concentration: true, ritual: false });
    expect(lireEnTeteDeSort(l, "Sort absent")).toBeNull();
  });
});
