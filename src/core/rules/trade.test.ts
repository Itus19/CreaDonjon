import { describe, expect, it } from "vitest";
import { settleTrade, type Trade } from "./trade";
import type { InventoryBlockData } from "../schemas/blocks/inventory";

function sac(partiel: Partial<InventoryBlockData> = {}): InventoryBlockData {
  return { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, ...partiel };
}

let compteur = 0;
const nouvelId = () => `nouveau-${++compteur}`;

describe("settleTrade — pièces", () => {
  it("paie un prix exact", () => {
    const trade: Trade = { give: [{ kind: "coins", coin: "sp", amount: 5 }], receive: [{ kind: "service", label: "Une nuit" }] };
    const result = settleTrade(sac({ currency: { pp: 0, gp: 0, ep: 0, sp: 5, cp: 0 } }), trade, nouvelId);
    expect(result).toEqual({ status: "settled", inventory: sac() });
  });

  it("rend la monnaie : 5 pa payées avec une pièce d'or", () => {
    const trade: Trade = { give: [{ kind: "coins", coin: "sp", amount: 5 }], receive: [] };
    const result = settleTrade(sac({ currency: { pp: 0, gp: 1, ep: 0, sp: 0, cp: 0 } }), trade, nouvelId);
    expect(result.status).toBe("settled");
    if (result.status === "settled") expect(result.inventory.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 5, cp: 0 });
  });

  it("dit combien il manque, sans rien changer", () => {
    const avant = sac({ currency: { pp: 0, gp: 0, ep: 0, sp: 3, cp: 0 } });
    const trade: Trade = { give: [{ kind: "coins", coin: "sp", amount: 5 }], receive: [] };
    expect(settleTrade(avant, trade, nouvelId)).toEqual({ status: "short", missing: [{ kind: "coins", missingCp: 20 }] });
    expect(avant.currency.sp).toBe(3);
  });

  it("compte les pièces reçues dans le même échange", () => {
    // Vendre pour 2 pa et payer 1 pa : solde positif même avec une bourse vide.
    const trade: Trade = { give: [{ kind: "coins", coin: "sp", amount: 1 }], receive: [{ kind: "coins", coin: "sp", amount: 2 }] };
    const result = settleTrade(sac(), trade, nouvelId);
    expect(result.status).toBe("settled");
    if (result.status === "settled") expect(result.inventory.currency.sp).toBe(1);
  });
});

describe("settleTrade — objets", () => {
  const dague = { id: "dague", ref: { kind: "rule" as const, key: "dagger" }, qty: 2 };
  const corde = { id: "corde", label: "Corde de chanvre", qty: 1 };

  it("vend un objet : il sort du sac, les pièces entrent", () => {
    const trade: Trade = { give: [{ kind: "item", itemId: "corde", qty: 1 }], receive: [{ kind: "coins", coin: "sp", amount: 5 }] };
    const result = settleTrade(sac({ items: [corde], containers: [{ id: "sac", label: "Sac", contains: ["corde"] }] }), trade, nouvelId);
    expect(result.status).toBe("settled");
    if (result.status === "settled") {
      expect(result.inventory.items).toEqual([]);
      expect(result.inventory.containers[0].contains).toEqual([]);
      expect(result.inventory.currency.sp).toBe(5);
    }
  });

  it("vend une partie d'une pile", () => {
    const trade: Trade = { give: [{ kind: "item", itemId: "dague", qty: 1 }], receive: [] };
    const result = settleTrade(sac({ items: [dague] }), trade, nouvelId);
    expect(result.status === "settled" && result.inventory.items).toEqual([{ ...dague, qty: 1 }]);
  });

  it("achète un objet de règle : il rejoint la pile existante", () => {
    const trade: Trade = { give: [{ kind: "coins", coin: "gp", amount: 2 }], receive: [{ kind: "item", item: { ref: { kind: "rule", key: "dagger" } }, qty: 1 }] };
    const result = settleTrade(sac({ items: [dague], currency: { pp: 0, gp: 2, ep: 0, sp: 0, cp: 0 } }), trade, nouvelId);
    expect(result.status === "settled" && result.inventory.items).toEqual([{ ...dague, qty: 3 }]);
  });

  it("n'empile pas sur un objet équipé : un nouvel objet entre", () => {
    const equipee = { ...dague, qty: 1, equipped: true };
    const trade: Trade = { give: [], receive: [{ kind: "item", item: { ref: { kind: "rule", key: "dagger" } }, qty: 1 }] };
    const result = settleTrade(sac({ items: [equipee] }), trade, () => "neuve");
    expect(result.status === "settled" && result.inventory.items).toEqual([equipee, { id: "neuve", ref: { kind: "rule", key: "dagger" }, qty: 1 }]);
  });

  it("échange objet contre objet", () => {
    const trade: Trade = { give: [{ kind: "item", itemId: "corde", qty: 1 }], receive: [{ kind: "item", item: { label: "Lanterne sourde" }, qty: 1 }] };
    const result = settleTrade(sac({ items: [corde] }), trade, () => "lanterne");
    expect(result.status === "settled" && result.inventory.items).toEqual([{ id: "lanterne", label: "Lanterne sourde", qty: 1 }]);
  });

  it("refuse un objet absent ou une quantité insuffisante, et liste tout ce qui manque", () => {
    const trade: Trade = {
      give: [
        { kind: "item", itemId: "dague", qty: 3 },
        { kind: "item", itemId: "bouclier", qty: 1 },
        { kind: "coins", coin: "gp", amount: 1 },
      ],
      receive: [],
    };
    expect(settleTrade(sac({ items: [dague] }), trade, nouvelId)).toEqual({
      status: "short",
      missing: [
        { kind: "item", itemId: "dague", missingQty: 1 },
        { kind: "item", itemId: "bouclier", missingQty: 1 },
        { kind: "coins", missingCp: 100 },
      ],
    });
  });

  it("additionne deux lignes qui donnent le même objet", () => {
    const trade: Trade = { give: [{ kind: "item", itemId: "dague", qty: 2 }, { kind: "item", itemId: "dague", qty: 1 }], receive: [] };
    expect(settleTrade(sac({ items: [dague] }), trade, nouvelId)).toEqual({ status: "short", missing: [{ kind: "item", itemId: "dague", missingQty: 1 }] });
  });

  it("refuse une quantité nulle ou négative plutôt que de l'interpréter", () => {
    const trade: Trade = { give: [{ kind: "item", itemId: "dague", qty: -1 }], receive: [] };
    expect(() => settleTrade(sac({ items: [dague] }), trade, nouvelId)).toThrow();
  });
});
