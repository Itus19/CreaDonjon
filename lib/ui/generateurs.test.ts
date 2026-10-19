import { describe, expect, it } from "vitest";
import { assemblerApercu, etiquettesVariantes, structureMenu, texteACopier } from "./generateurs";

describe("assemblerApercu", () => {
  it("découpe le gabarit en texte fixe et en morceaux tirés", () => {
    const morceaux = assemblerApercu("Le {mot} {adj}.", ["mot", "adj"], { mot: "Sanglier", adj: "Borgne" });
    expect(morceaux).toEqual([
      { type: "texte", texte: "Le " },
      { type: "tirage", cle: "mot", texte: "Sanglier" },
      { type: "texte", texte: " " },
      { type: "tirage", cle: "adj", texte: "Borgne" },
      { type: "texte", texte: "." },
    ]);
  });

  it("garde un morceau pas encore tiré avec un texte nul", () => {
    const morceaux = assemblerApercu("{mot}", ["mot"], {});
    expect(morceaux).toEqual([{ type: "tirage", cle: "mot", texte: null }]);
  });

  it("substitue les valeurs fixes (libellé de variante) en texte simple, fusionné au texte voisin", () => {
    const morceaux = assemblerApercu("Taverne {wealth} : {mot}", ["mot"], { mot: "Chope" }, { wealth: "Modeste" });
    expect(morceaux).toEqual([
      { type: "texte", texte: "Taverne Modeste : " },
      { type: "tirage", cle: "mot", texte: "Chope" },
    ]);
  });

  it("laisse visible une clé inconnue, comme le fait le serveur", () => {
    expect(assemblerApercu("a {inconnue} b", [], {})).toEqual([{ type: "texte", texte: "a {inconnue} b" }]);
  });

  it("garde un texte vide (prose absente) comme un tirage, pas comme un manque", () => {
    expect(assemblerApercu("{prose}", ["prose"], { prose: "" })).toEqual([{ type: "tirage", cle: "prose", texte: "" }]);
  });

  it("rend un gabarit sans emplacement tel quel", () => {
    expect(assemblerApercu("Rien à tirer", ["a"], {})).toEqual([{ type: "texte", texte: "Rien à tirer" }]);
  });
});

describe("etiquettesVariantes", () => {
  const axes = [
    { key: "wealth", options: [{ key: "modeste", label: "Modeste" }, { key: "reputee", label: "Réputée" }] },
    { key: "zone", options: [{ key: "bourg", label: "Bourg" }] },
  ];

  it("donne le libellé de l'option choisie par axe", () => {
    expect(etiquettesVariantes(axes, { wealth: "reputee", zone: "bourg" })).toEqual({ wealth: "Réputée", zone: "Bourg" });
  });

  it("ignore un axe sans choix connu ou resté sur Aléatoire", () => {
    expect(etiquettesVariantes(axes, { wealth: "__random__" })).toEqual({});
  });

  it("accepte l'absence d'axes", () => {
    expect(etiquettesVariantes(undefined, {})).toEqual({});
  });
});

describe("structureMenu", () => {
  it("découpe les plats par catégorie et par palier, et liste les boissons", () => {
    const menu = structureMenu();
    expect(menu.plats.map((c) => c.libelle)).toEqual(["Entrées", "Plats", "Desserts"]);
    expect(menu.plats[1].paliers).toEqual([
      { libelle: "Simple", cle: "plat-simple" },
      { libelle: "Moyen", cle: "plat-moyen" },
      { libelle: "Cher", cle: "plat-cher" },
    ]);
    expect(menu.boissons).toEqual([
      { libelle: "Avec alcool", cle: "boisson-alcool" },
      { libelle: "Sans alcool", cle: "boisson-sans-alcool" },
    ]);
  });
});

describe("texteACopier", () => {
  it("met le titre en tête puis chaque section tirée, en sautant les vides", () => {
    const texte = texteACopier("Le Sanglier Borgne", [
      { libelle: "Tenancier", texte: "Maëlle, bourrue" },
      { libelle: "Rumeur", texte: null },
      { libelle: "Ambiance", texte: "  " },
    ]);
    expect(texte).toBe("Le Sanglier Borgne\n\nTenancier\nMaëlle, bourrue");
  });

  it("fonctionne sans titre", () => {
    expect(texteACopier(null, [{ libelle: "Condition", texte: "Pluie" }])).toBe("Condition\nPluie");
  });
});
