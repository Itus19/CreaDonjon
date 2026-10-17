import { describe, expect, it } from "vitest";
import {
  aDesChangements,
  changementsAEnvoyer,
  deplacer,
  deplacerVers,
  estDepliable,
  resumeBloc,
  ordresApres,
  type BlocBrouillon,
  type IdentiteBrouillon,
} from "./editeurPlein";

function bloc(id: string, ordre: number, surcharge: Partial<BlocBrouillon> = {}): BlocBrouillon {
  return {
    id,
    version: 1,
    display: { label: id, layout: "prose" },
    data: { texte: id },
    visibilityLevel: "public",
    visibilityScopeId: null,
    displayOrder: ordre,
    ...surcharge,
  } as BlocBrouillon;
}

const identite: IdentiteBrouillon = { name: "Aldric", entityKind: "character", aliases: ["Al"], isPublic: true, isPc: false };

describe("deplacer", () => {
  it("monte et descend d'un cran", () => {
    expect(deplacer(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(deplacer(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("ne bouge pas aux extrémités et ne modifie jamais la liste d'origine", () => {
    const liste = ["a", "b", "c"];
    expect(deplacer(liste, 0, -1)).toEqual(["a", "b", "c"]);
    expect(deplacer(liste, 2, 1)).toEqual(["a", "b", "c"]);
    expect(liste).toEqual(["a", "b", "c"]);
  });
});

describe("deplacerVers", () => {
  it("place l'élément à l'index visé", () => {
    expect(deplacerVers(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(deplacerVers(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("ignore un index hors de la liste", () => {
    expect(deplacerVers(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(deplacerVers(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("ordresApres", () => {
  it("ne change rien quand l'ordre est déjà croissant", () => {
    const ordres = ordresApres([bloc("a", 1000), bloc("b", 2000), bloc("c", 3000)]);
    expect(ordres).toEqual({ a: 1000, b: 2000, c: 3000 });
  });

  it("ne change que le bloc déplacé", () => {
    // c remonte en tête : a et b gardent leur ordre.
    const ordres = ordresApres([bloc("c", 3000), bloc("a", 1000), bloc("b", 2000)]);
    expect(ordres.a).toBe(1000);
    expect(ordres.b).toBe(2000);
    expect(ordres.c).toBeLessThan(1000);
  });

  it("place un bloc descendu entre ses nouveaux voisins", () => {
    // a descend entre b et c.
    const ordres = ordresApres([bloc("b", 2000), bloc("a", 1000), bloc("c", 3000)]);
    expect(ordres.b).toBe(2000);
    expect(ordres.c).toBe(3000);
    expect(ordres.a).toBeGreaterThan(2000);
    expect(ordres.a).toBeLessThan(3000);
  });

  it("donne un ordre strictement croissant même quand deux blocs partagent le même", () => {
    const ordres = ordresApres([bloc("a", 1000), bloc("b", 1000), bloc("c", 1000)]);
    expect(ordres.a).toBeLessThan(ordres.b);
    expect(ordres.b).toBeLessThan(ordres.c);
  });

  it("gère une liste vide", () => {
    expect(ordresApres([])).toEqual({});
  });
});

describe("changementsAEnvoyer", () => {
  const initiaux = [bloc("a", 1000), bloc("b", 2000), bloc("c", 3000)];

  it("n'envoie rien sans changement", () => {
    expect(changementsAEnvoyer(initiaux, initiaux.map((b) => ({ ...b })))).toEqual([]);
  });

  it("n'envoie que les blocs dont le contenu a changé, au format de la route", () => {
    const brouillon = [initiaux[0], { ...initiaux[1], data: { texte: "autre" } }, initiaux[2]];
    const changements = changementsAEnvoyer(initiaux, brouillon);
    expect(changements).toEqual([
      {
        id: "b",
        version: 1,
        display: { label: "b", layout: "prose" },
        data: { texte: "autre" },
        visibility: { level: "public", scopeId: null },
        displayOrder: 2000,
      },
    ]);
  });

  it("voit un changement de titre ou de visibilité", () => {
    const brouillon = [
      { ...initiaux[0], display: { label: "Nouveau", layout: "prose" as const } },
      { ...initiaux[1], visibilityLevel: "gm" },
      initiaux[2],
    ];
    expect(changementsAEnvoyer(initiaux, brouillon).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("ignore l'ordre des clés d'un objet", () => {
    const avant = [bloc("a", 1000, { data: { x: 1, y: { p: 1, q: 2 } } })];
    const apres = [bloc("a", 1000, { data: { y: { q: 2, p: 1 }, x: 1 } })];
    expect(changementsAEnvoyer(avant, apres)).toEqual([]);
  });

  it("n'envoie que le bloc déplacé quand l'ordre change", () => {
    const brouillon = [initiaux[2], initiaux[0], initiaux[1]];
    const changements = changementsAEnvoyer(initiaux, brouillon);
    expect(changements.map((c) => c.id)).toEqual(["c"]);
    expect(changements[0].displayOrder).toBeLessThan(1000);
  });

  it("garde la version attendue du brouillon", () => {
    const brouillon = [{ ...initiaux[0], version: 4, data: { texte: "x" } }, initiaux[1], initiaux[2]];
    expect(changementsAEnvoyer(initiaux, brouillon)[0].version).toBe(4);
  });
});

describe("aDesChangements", () => {
  const blocs = [bloc("a", 1000), bloc("b", 2000)];

  it("est faux sans aucune modification", () => {
    expect(aDesChangements(blocs, blocs.map((b) => ({ ...b })), identite, { ...identite })).toBe(false);
  });

  it("voit une modification de bloc", () => {
    expect(aDesChangements(blocs, [blocs[0], { ...blocs[1], data: { texte: "x" } }], identite, identite)).toBe(true);
  });

  it("voit un réordonnancement", () => {
    expect(aDesChangements(blocs, [blocs[1], blocs[0]], identite, identite)).toBe(true);
  });

  it("voit une modification de l'identité", () => {
    expect(aDesChangements(blocs, blocs, identite, { ...identite, name: "Aldrich" })).toBe(true);
    expect(aDesChangements(blocs, blocs, identite, { ...identite, entityKind: "location" })).toBe(true);
    expect(aDesChangements(blocs, blocs, identite, { ...identite, aliases: ["Al", "Ric"] })).toBe(true);
  });
});

describe("estDepliable", () => {
  it("laisse la carte et la fiche de personnage sur la fiche", () => {
    expect(estDepliable("map")).toBe(false);
    expect(estDepliable("character")).toBe(false);
    expect(estDepliable("text")).toBe(true);
  });
});

describe("resumeBloc", () => {
  it("résume un texte par son début, tronqué", () => {
    const segment = (v: string) => ({ content: [{ t: "text", v }] });
    expect(resumeBloc("text", { segments: [segment("Un  vieux\nforgeron")] })).toBe("Un vieux forgeron");
    const long = resumeBloc("text", { segments: [segment("a".repeat(200))] });
    expect(long.length).toBe(70);
    expect(long.endsWith("…")).toBe(true);
  });

  it("compte les lignes des blocs en liste", () => {
    expect(resumeBloc("infobox", { entries: [1, 2, 3] })).toBe("3 lignes");
    expect(resumeBloc("quest", { objectives: [1] })).toBe("1 objectif");
  });

  it("reste vide quand il n'y a rien d'utile à dire", () => {
    expect(resumeBloc("image", {})).toBe("");
    expect(resumeBloc("text", null)).toBe("");
    expect(resumeBloc("infobox", { entries: "x" })).toBe("");
  });
});
