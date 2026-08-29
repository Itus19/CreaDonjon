import { describe, expect, it } from "vitest";
import { buildRelationsGraph, type GraphEdgeInput, type GraphEntityInput } from "./buildRelationsGraph";

const entities: GraphEntityInput[] = [
  { id: "a", name: "A", slug: "a", entityKind: "character" },
  { id: "b", name: "B", slug: "b", entityKind: "character" },
  { id: "c", name: "C", slug: "c", entityKind: "character" },
  { id: "d", name: "D", slug: "d", entityKind: "character" },
  { id: "e", name: "E", slug: "e", entityKind: "faction" },
];

// a - b - c - d, et a - e (etoile a un degre)
const edges: GraphEdgeInput[] = [
  { id: "e1", sourceId: "a", targetId: "b", relationType: "friend_of", label: "ami(e) de", visibilityLevel: "public" },
  { id: "e2", sourceId: "b", targetId: "c", relationType: "friend_of", label: "ami(e) de", visibilityLevel: "public" },
  { id: "e3", sourceId: "c", targetId: "d", relationType: "friend_of", label: "ami(e) de", visibilityLevel: "public" },
  { id: "e4", sourceId: "a", targetId: "e", relationType: "member_of", label: "membre de", visibilityLevel: "gm" },
];

describe("buildRelationsGraph", () => {
  it("racine seule quand maxDegree = 0", () => {
    const graph = buildRelationsGraph({ rootId: "a", maxDegree: 0, edges, entities });
    expect(graph.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(graph.edges).toEqual([]);
  });

  it("ne remonte que les voisins directs a degre 1, dans les deux sens", () => {
    const graph = buildRelationsGraph({ rootId: "a", maxDegree: 1, edges, entities });
    expect(new Set(graph.nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "e"]));
    expect(graph.nodes.find((n) => n.id === "a")?.degree).toBe(0);
    expect(graph.nodes.find((n) => n.id === "b")?.degree).toBe(1);
  });

  it("etend la portee avec un plus grand maxDegree", () => {
    const graph = buildRelationsGraph({ rootId: "a", maxDegree: 2, edges, entities });
    expect(new Set(graph.nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "c", "e"]));
    expect(graph.nodes.find((n) => n.id === "c")?.degree).toBe(2);
  });

  it("n'inclut jamais une arete dont une extremite est hors de portee", () => {
    const graph = buildRelationsGraph({ rootId: "a", maxDegree: 1, edges, entities });
    expect(graph.edges.map((e) => e.id).sort()).toEqual(["e1", "e4"]);
  });

  it("racine introuvable renvoie un graphe vide", () => {
    const graph = buildRelationsGraph({ rootId: "zzz", maxDegree: 3, edges, entities });
    expect(graph).toEqual({ nodes: [], edges: [] });
  });

  it("cache une arete entre deux nœuds au degre maximal (retour utilisateur : pas de lien visible entre deux entites du meme degre tant qu'on ne monte pas d'un cran)", () => {
    // b et c sont tous deux voisins directs de a (degre 1) ET relies entre
    // eux — ce troisieme lien ne doit apparaitre qu'a partir du degre 2,
    // jamais au degre 1 meme si les deux extremites sont deja visibles.
    const star: GraphEdgeInput[] = [
      { id: "ab", sourceId: "a", targetId: "b", relationType: "friend_of", label: "ami(e) de", visibilityLevel: "public" },
      { id: "ac", sourceId: "a", targetId: "c", relationType: "friend_of", label: "ami(e) de", visibilityLevel: "public" },
      { id: "bc", sourceId: "b", targetId: "c", relationType: "partner_of", label: "partenaire de", visibilityLevel: "public" },
    ];
    const atDegree1 = buildRelationsGraph({ rootId: "a", maxDegree: 1, edges: star, entities });
    expect(atDegree1.edges.map((e) => e.id).sort()).toEqual(["ab", "ac"]);

    const atDegree2 = buildRelationsGraph({ rootId: "a", maxDegree: 2, edges: star, entities });
    expect(atDegree2.edges.map((e) => e.id).sort()).toEqual(["ab", "ac", "bc"]);
  });

  it("ignore une arete dont une extremite n'existe pas parmi les entites fournies", () => {
    const withGhost: GraphEdgeInput[] = [
      ...edges,
      { id: "ghost", sourceId: "a", targetId: "inconnu", relationType: "knows", label: "connait", visibilityLevel: "public" },
    ];
    const graph = buildRelationsGraph({ rootId: "a", maxDegree: 3, edges: withGhost, entities });
    expect(graph.nodes.some((n) => n.id === "inconnu")).toBe(false);
    expect(graph.edges.some((e) => e.id === "ghost")).toBe(false);
  });
});
