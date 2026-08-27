import { describe, expect, it } from "vitest";
import { computeDroppedOrder } from "./computeDroppedOrder";

describe("computeDroppedOrder", () => {
  it("depose entre deux voisins : moyenne des deux display_order encadrants", () => {
    const items = [
      { id: "a", displayOrder: 1000 },
      { id: "b", displayOrder: 2000 },
      { id: "c", displayOrder: 3000 },
      { id: "d", displayOrder: 4000 },
    ];
    // "a" depose sur "c" : nouvel ordre [b, c, a, d] -> encadre par c et d.
    expect(computeDroppedOrder(items, "a", "c")).toBe((3000 + 4000) / 2);
  });

  it("depose en tete de liste : en dessous du premier restant", () => {
    const items = [
      { id: "a", displayOrder: 1000 },
      { id: "b", displayOrder: 2000 },
      { id: "c", displayOrder: 3000 },
    ];
    // "c" depose sur "a" : nouvel ordre [c, a, b] -> rien avant, "a" apres.
    expect(computeDroppedOrder(items, "c", "a")).toBe(1000 - 1000);
  });

  it("depose en fin de liste : au-dessus du dernier restant", () => {
    const items = [
      { id: "a", displayOrder: 1000 },
      { id: "b", displayOrder: 2000 },
      { id: "c", displayOrder: 3000 },
    ];
    // "a" depose sur "c" : nouvel ordre [b, c, a] -> "c" avant, rien apres.
    expect(computeDroppedOrder(items, "a", "c")).toBe(3000 + 1000);
  });

  it("source ou cible introuvable : null, rien ne bouge", () => {
    const items = [{ id: "a", displayOrder: 1000 }];
    expect(computeDroppedOrder(items, "zzz", "a")).toBeNull();
    expect(computeDroppedOrder(items, "a", "zzz")).toBeNull();
  });

  it("depot sur soi-meme : null", () => {
    const items = [
      { id: "a", displayOrder: 1000 },
      { id: "b", displayOrder: 2000 },
    ];
    expect(computeDroppedOrder(items, "a", "a")).toBeNull();
  });
});
