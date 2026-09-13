import { describe, expect, it } from "vitest";
import { wouldCreateCycle, moveItem, removeItemAndDescendants, nextSiblingPosition, renamePage } from "./tree";
import type { NoteTreeItem } from "../schemas/blocks/noteTree";

function page(id: string, parentId: string | null, position: number): NoteTreeItem {
  return { id, parentId, position, kind: "page", title: id, content: [] };
}
function pin(id: string, parentId: string | null, position: number): NoteTreeItem {
  return { id, parentId, position, kind: "pinned_entity", targetId: "e1" };
}

describe("wouldCreateCycle", () => {
  it("refuse de deplacer un noeud dans lui-meme", () => {
    const items = [page("a", null, 1000)];
    expect(wouldCreateCycle(items, "a", "a")).toBe(true);
  });

  it("refuse de deplacer un noeud dans un de ses descendants", () => {
    const items = [page("a", null, 1000), page("b", "a", 1000), page("c", "b", 1000)];
    expect(wouldCreateCycle(items, "a", "c")).toBe(true);
  });

  it("autorise un deplacement vers un parent sans lien de parente", () => {
    const items = [page("a", null, 1000), page("b", null, 2000), page("c", "a", 1000)];
    expect(wouldCreateCycle(items, "c", "b")).toBe(false);
  });

  it("autorise de remonter a la racine (parentId null)", () => {
    const items = [page("a", null, 1000), page("b", "a", 1000)];
    expect(wouldCreateCycle(items, "b", null)).toBe(false);
  });
});

describe("moveItem", () => {
  it("change le parent et repositionne parmi les nouveaux freres", () => {
    const items = [page("a", null, 1000), page("b", null, 2000), page("c", "a", 1000)];
    const next = moveItem(items, "c", null, 1);
    const c = next.find((i) => i.id === "c")!;
    expect(c.parentId).toBeNull();
    // Position doit se retrouver entre a (1000) et b (2000).
    expect(c.position).toBeGreaterThan(1000);
    expect(c.position).toBeLessThan(2000);
  });

  it("refuse silencieusement un deplacement qui creerait un cycle (retourne les items inchanges)", () => {
    const items = [page("a", null, 1000), page("b", "a", 1000)];
    const next = moveItem(items, "a", "b", 0);
    expect(next).toBe(items);
  });
});

describe("removeItemAndDescendants", () => {
  it("retire un noeud et toute sa descendance", () => {
    const items = [page("a", null, 1000), page("b", "a", 1000), pin("c", "b", 1000), page("d", null, 2000)];
    const next = removeItemAndDescendants(items, "a");
    expect(next.map((i) => i.id)).toEqual(["d"]);
  });

  it("ne touche pas aux items hors de la branche supprimee", () => {
    const items = [page("a", null, 1000), page("b", null, 2000)];
    const next = removeItemAndDescendants(items, "a");
    expect(next.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("nextSiblingPosition", () => {
  it("retourne 1000 pour une fratrie vide", () => {
    expect(nextSiblingPosition([], null)).toBe(1000);
  });

  it("retourne 1000 de plus que la position max de la fratrie", () => {
    const items = [page("a", null, 1000), page("b", null, 2500), page("c", "x", 9999)];
    expect(nextSiblingPosition(items, null)).toBe(3500);
  });
});

describe("renamePage", () => {
  it("renomme une page", () => {
    const items = [page("a", null, 1000)];
    const next = renamePage(items, "a", "Nouveau titre");
    expect(next.find((i) => i.id === "a")).toMatchObject({ title: "Nouveau titre" });
  });

  it("ne fait rien sur une fiche epinglee (pas de titre editable)", () => {
    const items = [pin("a", null, 1000)];
    const next = renamePage(items, "a", "Nouveau titre");
    expect(next).toBe(items);
  });
});
