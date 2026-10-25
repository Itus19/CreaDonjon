import { describe, expect, it } from "vitest";
import { insererMention, mentionEnCours, noeudsEditables, normaliserValeur, retirerMention, suggererFiches } from "./mentionValeur";

const sildar = { t: "ref" as const, kind: "entity" as const, id: "s1", label: "Sildar" };

describe("mentionEnCours", () => {
  it("repère « @ » suivi de la saisie, en début de champ ou après une espace", () => {
    expect(mentionEnCours("Allié de @Sil", 13)).toEqual({ debut: 9, requete: "Sil" });
    expect(mentionEnCours("@", 1)).toEqual({ debut: 0, requete: "" });
  });
  it("ignore une adresse ou un « @ » collé à un mot, et ce qui suit le curseur", () => {
    expect(mentionEnCours("ecrire a moi@mail", 17)).toBeNull();
    expect(mentionEnCours("rien ici", 8)).toBeNull();
    expect(mentionEnCours("@Sil dar", 2)).toEqual({ debut: 0, requete: "S" });
  });
  it("une requête trop longue ou sur plusieurs lignes n'est plus une mention", () => {
    expect(mentionEnCours("@" + "a".repeat(41), 42)).toBeNull();
    expect(mentionEnCours("@a\nb", 4)).toBeNull();
  });
});

describe("noeudsEditables", () => {
  it("place un champ de texte entre et autour des mentions", () => {
    expect(noeudsEditables("Côte")).toEqual([{ t: "text", v: "Côte" }]);
    expect(noeudsEditables([sildar])).toEqual([{ t: "text", v: "" }, sildar, { t: "text", v: "" }]);
  });
});

describe("insererMention et retirerMention", () => {
  it("remplace « @Sil » par la mention et laisse une espace pour continuer", () => {
    const noeuds = noeudsEditables("Allié de @Sil");
    const apres = insererMention(noeuds, 0, { debut: 9, fin: 13 }, sildar);
    expect(apres).toEqual([{ t: "text", v: "Allié de " }, sildar, { t: "text", v: " " }]);
  });
  it("retirer une mention recolle le texte autour", () => {
    const noeuds = [{ t: "text" as const, v: "Allié de " }, sildar, { t: "text" as const, v: " et Gundren" }];
    expect(normaliserValeur(retirerMention(noeuds, 1))).toBe("Allié de  et Gundren");
  });
});

describe("normaliserValeur", () => {
  it("sans mention, la valeur redevient une chaîne (la forme d'avant)", () => {
    expect(normaliserValeur([{ t: "text", v: "42" }, { t: "text", v: " ans" }])).toBe("42 ans");
    expect(normaliserValeur([])).toBe("");
  });
  it("avec mention : textes voisins fusionnés, textes vides retirés", () => {
    expect(normaliserValeur([{ t: "text", v: "" }, sildar, { t: "text", v: "a" }, { t: "text", v: "b" }])).toEqual([sildar, { t: "text", v: "ab" }]);
  });
});

describe("suggererFiches", () => {
  const fiches = [
    { id: "1", name: "Sildar Hallwinter" },
    { id: "2", name: "Phandaline" },
    { id: "3", name: "Éclat de sel" },
  ];
  it("filtre sans accents ni casse, au plus six", () => {
    expect(suggererFiches(fiches, "sil").map((f) => f.id)).toEqual(["1"]);
    expect(suggererFiches(fiches, "ECLAT").map((f) => f.id)).toEqual(["3"]);
    expect(suggererFiches(fiches, "").length).toBe(3);
  });
});
