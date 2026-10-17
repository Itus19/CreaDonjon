import { describe, expect, it } from "vitest";
import { ajouterRecent, cleRecents, lireDerniereVisite, lireRecents, MAX_RECENTS, type ElementRecent } from "./recents";

const el = (n: number): ElementRecent => ({ href: `/m/x/f/${n}`, titre: `Fiche ${n}` });

describe("ajouterRecent", () => {
  it("place le nouvel element en tete", () => {
    expect(ajouterRecent([el(1)], el(2)).map((e) => e.href)).toEqual(["/m/x/f/2", "/m/x/f/1"]);
  });

  it("remonte un element deja present au lieu de le dupliquer, avec son titre a jour", () => {
    const liste = ajouterRecent([el(1), el(2)], { href: "/m/x/f/2", titre: "Renomme" });
    expect(liste).toEqual([{ href: "/m/x/f/2", titre: "Renomme" }, el(1)]);
  });

  it("garde 20 elements au plus, en retirant les plus anciens", () => {
    let liste: ElementRecent[] = [];
    for (let i = 0; i < 25; i++) liste = ajouterRecent(liste, el(i));
    expect(liste).toHaveLength(MAX_RECENTS);
    expect(liste[0]?.href).toBe("/m/x/f/24");
    expect(liste[MAX_RECENTS - 1]?.href).toBe("/m/x/f/5");
  });

  it("ne modifie pas la liste d'origine", () => {
    const liste = [el(1)];
    ajouterRecent(liste, el(2));
    expect(liste).toEqual([el(1)]);
  });
});

describe("lireRecents", () => {
  it("rend une liste vide sans valeur", () => {
    expect(lireRecents(null)).toEqual([]);
  });

  it("rend une liste vide pour un JSON invalide ou d'une autre forme", () => {
    expect(lireRecents("{pas du json")).toEqual([]);
    expect(lireRecents('{"a":1}')).toEqual([]);
    expect(lireRecents('[{"href":1}]')).toEqual([]);
  });

  it("relit une liste valide et ignore tout champ en trop (jamais de contenu garde)", () => {
    const brut = JSON.stringify([{ href: "/m/x/f/1", titre: "A", type: "pj", contenu: "secret" }]);
    expect(lireRecents(brut)).toEqual([{ href: "/m/x/f/1", titre: "A", type: "pj" }]);
  });

  it("plafonne une liste trop longue", () => {
    const brut = JSON.stringify(Array.from({ length: 30 }, (_, i) => el(i)));
    expect(lireRecents(brut)).toHaveLength(MAX_RECENTS);
  });
});

describe("cleRecents", () => {
  it("separe les mondes et les espaces", () => {
    expect(cleRecents("a", "mj-monde")).not.toBe(cleRecents("b", "mj-monde"));
    expect(cleRecents("a", "mj-monde")).not.toBe(cleRecents("a", "joueur-wiki"));
    expect(cleRecents("a", "joueur-regles")).toContain("a");
  });
});

describe("dernière visite (V3.1-35)", () => {
  const visite = { worldSlug: "faerun", href: "/m/faerun/f/candide", titre: "Candide", type: "character", quand: "2026-10-17T10:00:00.000Z" };
  it("relit une visite valide", () => {
    expect(lireDerniereVisite(JSON.stringify(visite))).toEqual(visite);
  });
  it("rien de mémorisé, JSON cassé ou forme inconnue : null (pas de « Reprendre »)", () => {
    expect(lireDerniereVisite(null)).toBeNull();
    expect(lireDerniereVisite("{pas du json")).toBeNull();
    expect(lireDerniereVisite(JSON.stringify({ href: "/m/x" }))).toBeNull();
    expect(lireDerniereVisite(JSON.stringify({ ...visite, quand: "hier" }))).toBeNull();
  });
});
