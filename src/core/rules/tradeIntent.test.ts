import { describe, expect, it } from "vitest";
import { interpretTrade, splitCp, tradeForGift, tradeForOffer, tradeForSale, tradeOffersFromPriceList, type TradeCatalog } from "./tradeIntent";
import type { IntentTarget } from "./intent";

/**
 * V3.2-10 — Edran au Fanal : une carte (une nuit, une bière, une dague de
 * règle), un sac (une dague de règle, une corde libre), et Mabelle présente.
 */
const CATALOG: TradeCatalog = {
  verbs: [
    { direction: "buy", terms: ["prends", "prendre", "achete", "acheter", "commande"] },
    { direction: "sell", terms: ["vends", "vendre"] },
    { direction: "give", terms: ["donne", "donner"] },
  ],
  offers: [
    { id: "lodging-1", label: "Une nuit à l'auberge", terms: ["une nuit à l'auberge", "chambre", "nuit"], priceCp: 50, ruleKey: null },
    { id: "drinks-1", label: "Bière", terms: ["bière"], priceCp: 4, ruleKey: null },
    { id: "other-1", label: "Dague", terms: ["dague"], priceCp: 200, ruleKey: "dagger" },
  ],
  items: [
    { id: "inv-dague", label: "Dague", terms: ["dague"], resaleCp: 100 },
    { id: "inv-corde", label: "Corde de chanvre", terms: ["corde de chanvre", "corde"], resaleCp: null },
  ],
  purseCp: 30,
  hasPriceList: true,
};

const TARGETS: IntentTarget[] = [{ id: "entity:mabelle", label: "Mabelle", terms: ["mabelle"] }];

describe("interpretTrade — lire un échange", () => {
  it("« je prends la chambre » propose la nuit au prix de la carte", () => {
    const reading = interpretTrade("je prends la chambre", CATALOG, TARGETS);
    expect(reading).toEqual({
      kind: "trade",
      direction: "buy",
      entryId: "lodging-1",
      label: "Une nuit à l'auberge",
      priceCp: 50,
      target: null,
      matched: { verb: "prends", object: "chambre", target: null },
    });
  });

  it("nomme le PNJ quand la phrase le désigne", () => {
    const reading = interpretTrade("je commande une bière à Mabelle", CATALOG, TARGETS);
    expect(reading?.kind === "trade" && reading.target?.id).toBe("entity:mabelle");
  });

  it("« je vends ma dague » vise l'objet du sac, au prix de revente", () => {
    const reading = interpretTrade("je vends ma dague", CATALOG, TARGETS);
    expect(reading).toMatchObject({ kind: "trade", direction: "sell", entryId: "inv-dague", priceCp: 100 });
  });

  it("« acheter une dague » vise l'offre de la carte, pas le sac", () => {
    const reading = interpretTrade("j'achete une dague", CATALOG, TARGETS);
    expect(reading).toMatchObject({ kind: "trade", direction: "buy", entryId: "other-1", priceCp: 200 });
  });

  it("vendre un objet sans prix connu reste un échange, sans prix", () => {
    const reading = interpretTrade("je vends ma corde", CATALOG, TARGETS);
    expect(reading).toMatchObject({ kind: "trade", direction: "sell", entryId: "inv-corde", priceCp: null });
  });

  it("donner n'a pas de prix", () => {
    const reading = interpretTrade("je donne ma dague à Mabelle", CATALOG, TARGETS);
    expect(reading).toMatchObject({ kind: "trade", direction: "give", entryId: "inv-dague", priceCp: null, target: { id: "entity:mabelle" } });
  });

  it("un verbe seul ne suffit pas : « je prends la porte de gauche » n'est pas un achat", () => {
    expect(interpretTrade("je prends la porte de gauche", CATALOG, TARGETS)).toBeNull();
  });

  it("une offre nommée sans verbe d'échange n'est pas un achat", () => {
    expect(interpretTrade("la bière est tiède", CATALOG, TARGETS)).toBeNull();
  });

  it("un achat dans un lieu sans carte le dit, pour proposer de la tirer", () => {
    const sansCarte: TradeCatalog = { ...CATALOG, offers: [], hasPriceList: false };
    expect(interpretTrade("je prends une chambre", sansCarte, TARGETS)).toEqual({ kind: "no_price_list", verb: "prends" });
  });

  it("une phrase vide ne lit rien", () => {
    expect(interpretTrade("   ", CATALOG, TARGETS)).toBeNull();
  });
});

describe("splitCp — un montant en pièces courantes", () => {
  it("compose en or, argent et cuivre, jamais en platine ni électrum", () => {
    expect(splitCp(1234)).toEqual([
      { coin: "gp", amount: 12 },
      { coin: "sp", amount: 3 },
      { coin: "cp", amount: 4 },
    ]);
    expect(splitCp(50)).toEqual([{ coin: "sp", amount: 5 }]);
    expect(splitCp(0)).toEqual([]);
  });

  it("refuse un montant négatif ou fractionnaire", () => {
    expect(() => splitCp(-1)).toThrow();
    expect(() => splitCp(1.5)).toThrow();
  });
});

describe("construire l'échange que le moteur règle", () => {
  it("une nuit : des pièces contre un service", () => {
    expect(tradeForOffer(CATALOG.offers[0])).toEqual({
      give: [{ kind: "coins", coin: "sp", amount: 5 }],
      receive: [{ kind: "service", label: "Une nuit à l'auberge" }],
    });
  });

  it("une offre qui renvoie à une fiche de règle entre dans le sac", () => {
    expect(tradeForOffer(CATALOG.offers[2]).receive).toEqual([{ kind: "item", item: { ref: { kind: "rule", key: "dagger" } }, qty: 1 }]);
  });

  it("une offre gratuite ne demande rien", () => {
    expect(tradeForOffer({ ...CATALOG.offers[1], priceCp: 0 }).give).toEqual([]);
  });

  it("une vente : l'objet sort, la moitié de son prix entre", () => {
    expect(tradeForSale("inv-dague", 105)).toEqual({
      give: [{ kind: "item", itemId: "inv-dague", qty: 1 }],
      receive: [
        { kind: "coins", coin: "gp", amount: 1 },
        { kind: "coins", coin: "cp", amount: 5 },
      ],
    });
  });

  it("un don : l'objet sort, rien n'entre", () => {
    expect(tradeForGift("inv-corde")).toEqual({ give: [{ kind: "item", itemId: "inv-corde", qty: 1 }], receive: [] });
  });
});

describe("tradeOffersFromPriceList — la carte en catalogue", () => {
  it("donne à la nuit ses mots de tous les jours, et un prix en cuivre", () => {
    const offers = tradeOffersFromPriceList(
      [
        { id: "lodging-1", label: "Une nuit à l'auberge", group: "lodging", price: { amount: 5, coin: "sp" } },
        { id: "drinks-1", label: "Bière", group: "drinks", price: { amount: 4, coin: "cp" }, rule_key: "ale" },
      ],
      ["chambre"]
    );
    expect(offers).toEqual([
      { id: "lodging-1", label: "Une nuit à l'auberge", terms: ["Une nuit à l'auberge", "chambre"], priceCp: 50, ruleKey: null },
      { id: "drinks-1", label: "Bière", terms: ["Bière"], priceCp: 4, ruleKey: "ale" },
    ]);
  });
});
