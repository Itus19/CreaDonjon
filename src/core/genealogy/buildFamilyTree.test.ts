import { describe, expect, it } from "vitest";
import { buildFamilyTree, type FamilyEdgeInput, type FamilyEntityInput } from "./buildFamilyTree";

function entity(id: string): FamilyEntityInput {
  return { id, name: id, slug: id, entityKind: "character" };
}

describe("buildFamilyTree", () => {
  it("place la racine seule a la generation 0 sans aretes", () => {
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 2,
      depthDown: 2,
      edges: [],
      entities: [entity("root")],
    });
    expect(tree.nodes).toEqual([{ id: "root", name: "root", slug: "root", entityKind: "character", generation: 0, order: 0 }]);
    expect(tree.edges).toEqual([]);
  });

  it("place un parent a -1 et un enfant a +1", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "parent", targetId: "root", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "root", targetId: "child", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 1,
      depthDown: 1,
      edges,
      entities: [entity("root"), entity("parent"), entity("child")],
    });
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(byId.parent.generation).toBe(-1);
    expect(byId.root.generation).toBe(0);
    expect(byId.child.generation).toBe(1);
    expect(tree.edges).toContainEqual({ id: "e1", kind: "parent-child", fromId: "parent", toId: "root", label: "parent de", visibilityLevel: "public" });
    expect(tree.edges).toContainEqual({ id: "e2", kind: "parent-child", fromId: "root", toId: "child", label: "parent de", visibilityLevel: "public" });
  });

  it("inclut le partenaire a la meme generation sans consommer de profondeur", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "root", targetId: "spouse", relationType: "married_to", label: "marie(e) a", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 0,
      depthDown: 0,
      edges,
      entities: [entity("root"), entity("spouse")],
    });
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(byId.root.generation).toBe(0);
    expect(byId.spouse.generation).toBe(0);
    expect(tree.edges).toContainEqual({ id: "e1", kind: "partner", fromId: "root", toId: "spouse", label: "marie(e) a", visibilityLevel: "public" });
  });

  it("relie un enfant a ses deux parents maries", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "p1", targetId: "child", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "p2", targetId: "child", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e3", sourceId: "p1", targetId: "p2", relationType: "married_to", label: "marie(e) a", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "child",
      depthUp: 1,
      depthDown: 1,
      edges,
      entities: [entity("child"), entity("p1"), entity("p2")],
    });
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(byId.p1.generation).toBe(-1);
    expect(byId.p2.generation).toBe(-1);
    expect(tree.edges).toHaveLength(3);
  });

  it("respecte depthUp : un grand-parent hors de portee n'apparait pas", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "grandparent", targetId: "parent", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "parent", targetId: "root", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 1,
      depthDown: 0,
      edges,
      entities: [entity("root"), entity("parent"), entity("grandparent")],
    });
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(["parent", "root"]);
  });

  it("adopted_by cree un lien parent-enfant dans le bon sens (l'adoptant est le parent)", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "child", targetId: "root", relationType: "adopted_by", label: "adopte(e) par", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 0,
      depthDown: 1,
      edges,
      entities: [entity("root"), entity("child")],
    });
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(byId.child.generation).toBe(1);
    expect(tree.edges).toContainEqual({ id: "e1", kind: "parent-child", fromId: "root", toId: "child", label: "adopte(e) par", visibilityLevel: "public" });
  });

  it("step_parent_of cree un lien parent-enfant dans le sens source=beau-parent", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "root", targetId: "stepchild", relationType: "step_parent_of", label: "beau-parent de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 0,
      depthDown: 1,
      edges,
      entities: [entity("root"), entity("stepchild")],
    });
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
    expect(byId.stepchild.generation).toBe(1);
  });

  it("relie deux freres/sœurs explicites qui ne partagent aucun parent visible", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "root", targetId: "sibling", relationType: "sibling_of", label: "frere/sœur de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 1,
      depthDown: 1,
      edges,
      entities: [entity("root"), entity("sibling")],
    });
    expect(tree.edges).toContainEqual({ id: "e1", kind: "sibling", fromId: "root", toId: "sibling", label: "frere/sœur de", visibilityLevel: "public" });
  });

  it("n'ajoute pas de trait fratrie redondant quand un connecteur parent-enfant commun existe deja", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "parent", targetId: "root", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "parent", targetId: "sibling", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e3", sourceId: "root", targetId: "sibling", relationType: "sibling_of", label: "frere/sœur de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 1,
      depthDown: 1,
      edges,
      entities: [entity("root"), entity("parent"), entity("sibling")],
    });
    expect(tree.edges.find((e) => e.kind === "sibling")).toBeUndefined();
    expect(tree.edges).toHaveLength(2);
  });

  it("place les partenaires a des positions adjacentes dans la generation", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "p1", targetId: "child", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "p2", targetId: "child", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e3", sourceId: "p1", targetId: "p2", relationType: "married_to", label: "marie(e) a", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "child",
      depthUp: 1,
      depthDown: 0,
      edges,
      entities: [entity("child"), entity("p1"), entity("p2")],
    });
    const p1 = tree.nodes.find((n) => n.id === "p1")!;
    const p2 = tree.nodes.find((n) => n.id === "p2")!;
    expect(Math.abs(p1.order - p2.order)).toBe(1);
  });

  it("ignore une arete dont une extremite n'a pas ete visitee (hors profondeur)", () => {
    const edges: FamilyEdgeInput[] = [
      { id: "e1", sourceId: "parent", targetId: "root", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
      { id: "e2", sourceId: "grandparent", targetId: "parent", relationType: "parent_of", label: "parent de", visibilityLevel: "public" },
    ];
    const tree = buildFamilyTree({
      rootId: "root",
      depthUp: 1,
      depthDown: 0,
      edges,
      entities: [entity("root"), entity("parent"), entity("grandparent")],
    });
    expect(tree.edges.some((e) => e.fromId === "grandparent")).toBe(false);
  });
});
