import { describe, expect, it } from "vitest";
import { idNouvelleOffre, libelleRichesse, rubriquesDeLaCarte } from "./carteTarifs";
import type { PriceListOffer } from "@/src/core/schemas/blocks/priceList";

const OFFRES: PriceListOffer[] = [
  { id: "drinks-1", label: "Bière", group: "drinks", price: { amount: 4, coin: "cp" } },
  { id: "lodging-1", label: "Une nuit", group: "lodging", price: { amount: 5, coin: "sp" } },
  { id: "mains-1", label: "Ragoût", group: "mains", price: { amount: 1, coin: "sp" } },
];

describe("rubriquesDeLaCarte", () => {
  it("range les offres dans l'ordre des rubriques et saute les vides", () => {
    expect(rubriquesDeLaCarte(OFFRES).map((r) => [r.libelle, r.offres.map((o) => o.label)])).toEqual([
      ["Hébergement", ["Une nuit"]],
      ["Plats", ["Ragoût"]],
      ["Boissons", ["Bière"]],
    ]);
  });
});

describe("idNouvelleOffre", () => {
  it("prend le rang suivant de la rubrique", () => {
    expect(idNouvelleOffre(OFFRES, "drinks")).toBe("drinks-2");
    expect(idNouvelleOffre(OFFRES, "other")).toBe("other-1");
  });

  it("saute un identifiant déjà pris après une suppression", () => {
    const offres: PriceListOffer[] = [{ id: "drinks-2", label: "Vin", group: "drinks", price: { amount: 2, coin: "sp" } }];
    expect(idNouvelleOffre(offres, "drinks")).toBe("drinks-3");
  });
});

describe("libelleRichesse", () => {
  it("lit le libellé de l'axe du générateur Taverne", () => {
    expect(libelleRichesse("reputee")).toBe("Réputée");
    expect(libelleRichesse("inconnue")).toBe("inconnue");
    expect(libelleRichesse(null)).toBeNull();
  });
});
