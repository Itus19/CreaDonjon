import { describe, expect, it } from "vitest";
import type { RelationsGraph, RelationsGraphNode } from "@/src/core/relationsGraph/buildRelationsGraph";
import {
  filtresParGenre,
  groupeDe,
  idsVisibles,
  lienVisible,
  liensDeCarte,
  nomsUtiles,
  toucher,
  trouver,
  voisinage,
} from "./reseau";

const noeud = (id: string, entityKind: string, degree: number, name = id): RelationsGraphNode => ({
  id,
  name,
  slug: id,
  entityKind,
  hasPortrait: false,
  degree,
});
const lien = (id: string, fromId: string, toId: string, label = "lié à") => ({
  id,
  fromId,
  toId,
  relationType: "knows",
  label,
  visibilityLevel: "public",
});

//   centre ── a ── b        c ── d  (c et d : voisins de b ? non : c lié à b)
const graph: RelationsGraph = {
  nodes: [
    noeud("centre", "character", 0, "Sildar"),
    noeud("a", "location", 1, "Phandalin"),
    noeud("b", "faction", 1, "Alliance"),
    noeud("c", "item", 2, "Épée"),
    noeud("d", "creature", 2, "Éléonore"),
  ],
  edges: [lien("e1", "centre", "a"), lien("e2", "b", "centre", "membre de"), lien("e3", "a", "c"), lien("e4", "c", "d")],
};

describe("voisinage", () => {
  it("allume exactement les liens et les voisins de la vignette", () => {
    const v = voisinage(graph, "centre");
    expect([...v.noeuds].sort()).toEqual(["a", "b", "centre"]);
    expect([...v.liens].sort()).toEqual(["e1", "e2"]);
  });
  it("une feuille n'allume que son lien et son voisin", () => {
    const v = voisinage(graph, "d");
    expect([...v.noeuds].sort()).toEqual(["c", "d"]);
    expect([...v.liens]).toEqual(["e4"]);
  });
  it("une fiche sans lien ne s'allume que elle-même", () => {
    expect([...voisinage({ edges: [] }, "x").noeuds]).toEqual(["x"]);
  });
});

describe("filtres par genre", () => {
  it("compte chaque genre, hors fiche du centre, et range 'autres' à la fin", () => {
    expect(filtresParGenre(graph.nodes)).toEqual([
      { groupe: "location", n: 1 },
      { groupe: "faction", n: 1 },
      { groupe: "item", n: 1 },
      { groupe: "autre", n: 1 },
    ]);
  });
  it("ne propose pas un genre absent", () => {
    expect(filtresParGenre([noeud("c", "character", 0)])).toEqual([]);
  });
  it("les genres hors charte vont dans 'autres'", () => {
    expect(groupeDe("creature")).toBe("autre");
    expect(groupeDe("quest")).toBe("autre");
    expect(groupeDe("faction")).toBe("faction");
  });
});

describe("la fiche du centre n'est jamais masquée", () => {
  it("même si son genre est masqué", () => {
    const visibles = idsVisibles(graph.nodes, new Set(["character", "location"]));
    expect(visibles.has("centre")).toBe(true);
    expect(visibles.has("a")).toBe(false);
    expect(visibles.has("b")).toBe(true);
  });
  it("masquer tous les genres laisse le centre", () => {
    const visibles = idsVisibles(graph.nodes, new Set(["character", "location", "faction", "item", "autre"]));
    expect([...visibles]).toEqual(["centre"]);
  });
  it("un lien dont un bout est masqué disparaît", () => {
    const visibles = idsVisibles(graph.nodes, new Set(["location"]));
    expect(lienVisible(graph.edges[0], visibles)).toBe(false);
    expect(lienVisible(graph.edges[1], visibles)).toBe(true);
  });
});

describe("trouver", () => {
  it("cherche dans le nom, sans accents ni casse", () => {
    expect([...trouver(graph.nodes, "eleonore")]).toEqual(["d"]);
    expect([...trouver(graph.nodes, "ÉPÉE")]).toEqual(["c"]);
    expect([...trouver(graph.nodes, "an")].sort()).toEqual(["a", "b"]);
  });
  it("un texte vide ou sans correspondance ne fait rien briller", () => {
    expect(trouver(graph.nodes, "  ").size).toBe(0);
    expect(trouver(graph.nodes, "zzz").size).toBe(0);
  });
});

describe("le toucher au téléphone", () => {
  it("premier toucher = sélection, second = ouverture", () => {
    const premier = toucher({ selection: null }, "a");
    expect(premier).toEqual({ etat: { selection: "a" }, ouvrir: false });
    const second = toucher(premier.etat, "a");
    expect(second.ouvrir).toBe(true);
  });
  it("toucher une autre vignette déplace la sélection sans ouvrir", () => {
    const r = toucher({ selection: "a" }, "b");
    expect(r).toEqual({ etat: { selection: "b" }, ouvrir: false });
    expect(toucher(r.etat, "a").ouvrir).toBe(false);
  });
});

describe("noms utiles", () => {
  it("sans sélection, seulement la fiche du centre", () => {
    expect([...nomsUtiles(graph, null)]).toEqual(["centre"]);
  });
  it("avec une sélection : le centre, la sélection et ses voisins", () => {
    expect([...nomsUtiles(graph, "c")].sort()).toEqual(["a", "c", "centre", "d"]);
  });
});

describe("liensDeCarte", () => {
  it("donne au plus trois liens, avec le nom de l'autre bout et le sens", () => {
    const l = liensDeCarte(graph, "centre");
    expect(l).toEqual([
      { id: "e1", label: "lié à", autre: "Phandalin", sortant: true },
      { id: "e2", label: "membre de", autre: "Alliance", sortant: false },
    ]);
    const beaucoup: RelationsGraph = {
      nodes: graph.nodes,
      edges: ["x1", "x2", "x3", "x4"].map((id) => lien(id, "centre", "a")),
    };
    expect(liensDeCarte(beaucoup, "centre")).toHaveLength(3);
  });
});
