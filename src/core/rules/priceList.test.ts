import { describe, expect, it } from "vitest";
import {
  buildPriceList,
  itemCostPrice,
  lodgingPriceFromRows,
  lodgingTierForWealth,
  offersFromMenuSlots,
  parsePriceText,
  priceCp,
  resaleCp,
  seedFromId,
} from "./priceList";
import { zPriceListBlockData } from "../schemas/blocks/priceList";

/** Extrait de la fiche « Train de vie » telle que `scripts/write-lifestyle-expenses-2024.ts` l'écrit. */
const LIFESTYLE_ROWS = [
  { "Service/produit": "Bière (pichet)", Prix: "4 pc" },
  { "Service/produit": "Repas — modeste", Prix: "1 pa" },
  { "Service/produit": "Séjour à l’auberge (par jour) — misérable", Prix: "7 pc" },
  { "Service/produit": "Séjour à l’auberge (par jour) — modeste", Prix: "5 pa" },
  { "Service/produit": "Séjour à l’auberge (par jour) — confortable", Prix: "8 pa" },
  { "Service/produit": "Séjour à l’auberge (par jour) — riche", Prix: "2 po" },
];

describe("parsePriceText", () => {
  it("lit les abréviations françaises du SRD", () => {
    expect(parsePriceText("5 pa")).toEqual({ amount: 5, coin: "sp" });
    expect(parsePriceText("4 pc")).toEqual({ amount: 4, coin: "cp" });
    expect(parsePriceText("2 po")).toEqual({ amount: 2, coin: "gp" });
    expect(parsePriceText("1 pe")).toEqual({ amount: 1, coin: "ep" });
    expect(parsePriceText("3 pp")).toEqual({ amount: 3, coin: "pp" });
  });

  it("lit aussi les clés anglaises et tolère espaces et majuscules", () => {
    expect(parsePriceText(" 10 GP ")).toEqual({ amount: 10, coin: "gp" });
    expect(parsePriceText("1,5 po")).toEqual({ amount: 1.5, coin: "gp" });
  });

  it("refuse ce qui n'est pas un prix plutôt que d'en deviner un", () => {
    expect(parsePriceText("cinq pièces")).toBeNull();
    expect(parsePriceText("5")).toBeNull();
    expect(parsePriceText("5 pa par jour")).toBeNull();
    expect(parsePriceText("")).toBeNull();
  });
});

describe("priceCp et resaleCp", () => {
  it("convertit en cuivre", () => {
    expect(priceCp({ amount: 5, coin: "sp" })).toBe(50);
    expect(priceCp({ amount: 2, coin: "gp" })).toBe(200);
  });

  it("revend à la moitié, arrondie au cuivre inférieur", () => {
    expect(resaleCp(200)).toBe(100);
    expect(resaleCp(5)).toBe(2);
    expect(resaleCp(1)).toBe(0);
  });
});

describe("itemCostPrice", () => {
  it("lit le bloc cost d'un objet du SRD", () => {
    expect(itemCostPrice({ value: 15, unit: "gp" })).toEqual({ amount: 15, coin: "gp" });
    expect(itemCostPrice({ value: 2, unit: "sp" })).toEqual({ amount: 2, coin: "sp" });
  });

  it("refuse une unité inconnue ou un prix négatif", () => {
    expect(itemCostPrice({ value: 15, unit: "lb" })).toBeNull();
    expect(itemCostPrice({ value: -1, unit: "gp" })).toBeNull();
  });
});

describe("prix de la nuit", () => {
  it("fait correspondre la richesse du générateur au train de vie du SRD", () => {
    expect(lodgingTierForWealth("modeste")).toBe("modeste");
    expect(lodgingTierForWealth("correcte")).toBe("confortable");
    expect(lodgingTierForWealth("reputee")).toBe("riche");
    expect(lodgingTierForWealth("inconnue")).toBeNull();
  });

  it("lit le séjour à l'auberge du palier dans la fiche Train de vie", () => {
    expect(lodgingPriceFromRows(LIFESTYLE_ROWS, "modeste")).toEqual({ amount: 5, coin: "sp" });
    expect(lodgingPriceFromRows(LIFESTYLE_ROWS, "riche")).toEqual({ amount: 2, coin: "gp" });
  });

  it("ne confond pas le repas et le séjour du même palier", () => {
    expect(lodgingPriceFromRows([{ "Service/produit": "Repas — modeste", Prix: "1 pa" }], "modeste")).toBeNull();
  });

  it("rend null quand le palier manque", () => {
    expect(lodgingPriceFromRows(LIFESTYLE_ROWS, "aristocratique")).toBeNull();
  });
});

describe("offersFromMenuSlots", () => {
  it("range les plats par rubrique et garde les boissons d'un tirage multiple", () => {
    const offers = offersFromMenuSlots([
      { key: "entree-simple", text: "Soupe aux poireaux", price: { amount: 3, coin: "cp" } },
      { key: "plat-moyen", text: "Ragoût de mouton", price: { amount: 1, coin: "sp" } },
      { key: "dessert-cher", text: "Tarte aux mûres", price: { amount: 4, coin: "sp" } },
      {
        key: "boisson-alcool",
        text: "Bière brune, hydromel",
        items: [
          { text: "Bière brune", price: { amount: 4, coin: "cp" } },
          { text: "Hydromel", price: { amount: 6, coin: "cp" } },
        ],
      },
    ]);
    expect(offers.map((o) => [o.id, o.group, o.label])).toEqual([
      ["starters-1", "starters", "Soupe aux poireaux"],
      ["mains-1", "mains", "Ragoût de mouton"],
      ["desserts-1", "desserts", "Tarte aux mûres"],
      ["drinks-1", "drinks", "Bière brune"],
      ["drinks-2", "drinks", "Hydromel"],
    ]);
  });

  it("saute un emplacement sans prix et un plat déjà servi par un autre palier", () => {
    const offers = offersFromMenuSlots([
      { key: "plat-simple", text: "Ragoût", price: { amount: 1, coin: "sp" } },
      { key: "plat-moyen", text: "Ragoût", price: { amount: 1, coin: "sp" } },
      { key: "plat-cher", text: "Rôti" },
      { key: "inconnu", text: "Mystère", price: { amount: 1, coin: "sp" } },
    ]);
    expect(offers.map((o) => o.label)).toEqual(["Ragoût"]);
  });
});

describe("buildPriceList", () => {
  it("met la nuit en tête et produit un bloc valide", () => {
    const data = buildPriceList({
      wealth: "modeste",
      seed: 42,
      lodging: { amount: 5, coin: "sp" },
      menuSlots: [{ key: "plat-simple", text: "Ragoût", price: { amount: 1, coin: "sp" } }],
    });
    expect(data.offers[0]).toEqual({ id: "lodging-1", label: "Une nuit à l'auberge", group: "lodging", price: { amount: 5, coin: "sp" } });
    expect(data.offers[1].label).toBe("Ragoût");
    expect(zPriceListBlockData.safeParse(data).success).toBe(true);
  });

  it("se passe de la nuit quand la fiche Train de vie manque", () => {
    const data = buildPriceList({ wealth: null, seed: 1, lodging: null, menuSlots: [] });
    expect(data.offers).toEqual([]);
  });
});

describe("seedFromId", () => {
  it("donne toujours la même graine pour le même lieu, et une autre pour un autre", () => {
    const a = seedFromId("0f6e3c1a-1111-4b1b-9a1a-000000000001");
    expect(seedFromId("0f6e3c1a-1111-4b1b-9a1a-000000000001")).toBe(a);
    expect(seedFromId("0f6e3c1a-1111-4b1b-9a1a-000000000002")).not.toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(2 ** 32);
  });
});
