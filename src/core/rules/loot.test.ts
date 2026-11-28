import { describe, expect, it } from "vitest";
import { butinVisible } from "./loot";
import type { InventoryBlockData } from "../schemas/blocks/inventory";

const sac = (p: Partial<InventoryBlockData>): InventoryBlockData =>
  ({ __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ...p }) as InventoryBlockData;

describe("butinVisible (ADR 0123 : ce qu'un pillard prend à qui est à terre)", () => {
  it("toute la bourse, pièce par pièce, ce qui sort d'un sac entre dans l'autre", () => {
    const b = butinVisible(sac({ currency: { pp: 0, gp: 14, ep: 0, sp: 6, cp: 0, extra: { couronne: 2 } } }));
    expect(b.give).toEqual([
      { kind: "coins", coin: "gp", amount: 14 },
      { kind: "coins", coin: "sp", amount: 6 },
      { kind: "coins", coin: "couronne", amount: 2 },
    ]);
    expect(b.receive).toEqual(b.give);
  });

  it("ce qu'on tient en main et qui se voit ; jamais le caché, ce qu'on porte sur soi, ni le fond du sac", () => {
    const b = butinVisible(
      sac({
        items: [
          { id: "epee", qty: 1, equipped: true, slot: "main_hand", ref: { kind: "rule", key: "longsword" } },
          { id: "couteau", qty: 1, equipped: true, slot: "off_hand", concealed: true, label: "Couteau" },
          { id: "corde", qty: 1, label: "Corde" },
          { id: "torche", qty: 1, equipped: true, slot: "off_hand", label: "Torche" },
          { id: "habits", qty: 1, equipped: true, label: "Vêtements ordinaires" },
        ],
      })
    );
    expect(b.give).toEqual([
      { kind: "item", itemId: "epee", qty: 1 },
      { kind: "item", itemId: "torche", qty: 1 },
    ]);
    expect(b.receive).toEqual([
      { kind: "item", item: { ref: { kind: "rule", key: "longsword" } }, qty: 1 },
      { kind: "item", item: { label: "Torche" }, qty: 1 },
    ]);
    expect(b.objets).toBe(2);
  });

  it("rien à prendre : des listes vides", () => {
    expect(butinVisible(sac({}))).toEqual({ give: [], receive: [], objets: 0 });
  });
});
