import { describe, expect, it } from "vitest";
import { zInventoryBlockData } from "./inventory";

describe("zInventoryBlockData", () => {
  it("accepte les trois natures d'objet", () => {
    const data = {
      __v: 1 as const,
      items: [
        { id: "i1", ref: { kind: "rule" as const, key: "scimitar" }, qty: 1, equipped: true, slot: "main_hand" },
        { id: "i2", ref: { kind: "entity" as const, id: "ent_excalibur" }, qty: 1, attuned: true, equipped: true },
        {
          id: "i3",
          label: "Fiole de sable noir",
          qty: 3,
          weight: { value: 0.2, unit: "kg" },
          notes: "Trouvée dans la crypte.",
        },
      ],
      containers: [{ id: "c1", label: "Sac", contains: ["i3"] }],
      currency: { pp: 0, gp: 61, ep: 0, sp: 0, cp: 0 },
    };
    expect(zInventoryBlockData.parse(data)).toEqual(data);
  });

  it("rejette un objet sans reference ni libelle", () => {
    const data = {
      __v: 1,
      items: [{ id: "i1", qty: 1 }],
      containers: [],
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    };
    expect(() => zInventoryBlockData.parse(data)).toThrow();
  });
});
