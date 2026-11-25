/**
 * V3.2-9 — noyau pur du bloc « Carte et tarifs » à l'écran : les rubriques
 * dans l'ordre, l'identifiant d'une offre ajoutée à la main, et le libellé de
 * la richesse retenue. Le composant ne fait que brancher.
 */
import { GENERATOR_TOOLS } from "@/src/core/generators/tools";
import { PRICE_LIST_GROUPS, type PriceListGroup, type PriceListOffer } from "@/src/core/schemas/blocks/priceList";

export const LIBELLES_RUBRIQUES: Record<PriceListGroup, string> = {
  lodging: "Hébergement",
  starters: "Entrées",
  mains: "Plats",
  desserts: "Desserts",
  drinks: "Boissons",
  other: "Autres",
};

/** Les offres rangées par rubrique, dans l'ordre de `PRICE_LIST_GROUPS` ; les rubriques vides sont sautées. */
export function rubriquesDeLaCarte(offres: readonly PriceListOffer[]): { rubrique: PriceListGroup; libelle: string; offres: PriceListOffer[] }[] {
  return PRICE_LIST_GROUPS.map((rubrique) => ({ rubrique, libelle: LIBELLES_RUBRIQUES[rubrique], offres: offres.filter((o) => o.group === rubrique) })).filter(
    (r) => r.offres.length > 0
  );
}

/** Identifiant libre d'une offre ajoutée à la main dans une rubrique (`drinks-3`…), jamais celui d'une offre existante. */
export function idNouvelleOffre(offres: readonly PriceListOffer[], rubrique: PriceListGroup): string {
  const pris = new Set(offres.map((o) => o.id));
  let n = offres.filter((o) => o.group === rubrique).length + 1;
  while (pris.has(`${rubrique}-${n}`)) n += 1;
  return `${rubrique}-${n}`;
}

/** Libellé de la richesse retenue (« Modeste ») d'après l'axe `wealth` du générateur Taverne ; la clé brute si l'axe ne la connaît pas. */
export function libelleRichesse(cle: string | null): string | null {
  if (!cle) return null;
  const axe = GENERATOR_TOOLS.find((t) => t.key === "taverne")?.variants?.find((v) => v.key === "wealth");
  return axe?.options.find((o) => o.key === cle)?.label ?? cle;
}
