import { COIN_VALUE_CP, CURRENCY_ORDER, type CoinType } from "./currency";
import type { OfferPrice, PriceListBlockData, PriceListGroup, PriceListOffer } from "../schemas/blocks/priceList";

/**
 * V3.2-9 (ADR 0110) — les prix du commerce, sans lecture ni hasard.
 *
 * Trois sources, jamais le modèle : le bloc `cost` d'un objet de règle, la
 * fiche « Train de vie » du SRD 2024 pour la nuit à l'auberge, et le Menu du
 * générateur Taverne, dont chaque entrée porte déjà un prix structuré.
 */

/** Abréviations françaises du SRD (pc, pa, pe, po, pp) et clés techniques anglaises. */
const COIN_BY_ABBREVIATION: Record<string, CoinType> = {
  pc: "cp",
  pa: "sp",
  pe: "ep",
  po: "gp",
  pp: "pp",
  cp: "cp",
  sp: "sp",
  ep: "ep",
  gp: "gp",
};

/** « 5 pa » → `{ amount: 5, coin: "sp" }`. Tout autre texte rend `null` : un prix ne se devine pas. */
export function parsePriceText(text: string): OfferPrice | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*([a-z]{2})\s*$/i.exec(text);
  if (!match) return null;
  const coin = COIN_BY_ABBREVIATION[match[2].toLowerCase()];
  if (!coin) return null;
  return { amount: Number(match[1].replace(",", ".")), coin };
}

/** Valeur d'un prix en pièces de cuivre (valeurs fixes du SRD : un prix de carte est toujours en pièces standard). */
export function priceCp(price: OfferPrice): number {
  return Math.round(price.amount * COIN_VALUE_CP[price.coin]);
}

/** Revente : la moitié du prix, arrondie au cuivre inférieur (MdJ 2024). */
export function resaleCp(costCp: number): number {
  return Math.floor(costCp / 2);
}

/** Le bloc `cost` d'un objet de règle (`{ value: 15, unit: "gp" }`) en prix ; `null` si l'unité n'est pas une pièce. */
export function itemCostPrice(cost: { value: number; unit: string }): OfferPrice | null {
  const coin = (CURRENCY_ORDER as readonly string[]).includes(cost.unit) ? (cost.unit as CoinType) : null;
  if (!coin || !(cost.value >= 0)) return null;
  return { amount: cost.value, coin };
}

/**
 * Richesse du générateur → palier de train de vie du SRD (V2-J14 : les
 * paliers du générateur doivent rester cohérents avec ceux du jeu). Une
 * taverne modeste loge comme un train de vie modeste ; une correcte, comme
 * un confortable ; une réputée, comme un riche.
 */
const LODGING_TIER_BY_WEALTH: Record<string, string> = {
  modeste: "modeste",
  correcte: "confortable",
  reputee: "riche",
};

export function lodgingTierForWealth(wealth: string): string | null {
  return LODGING_TIER_BY_WEALTH[wealth] ?? null;
}

/**
 * Le prix d'une nuit dans le tableau « Repas, boisson et hébergement » de la
 * fiche « Train de vie » : la ligne « Séjour à l'auberge … — <palier> ».
 * Lit la première colonne comme libellé et la colonne « Prix ».
 */
export function lodgingPriceFromRows(rows: readonly Record<string, unknown>[], tier: string): OfferPrice | null {
  for (const row of rows) {
    const values = Object.values(row).filter((v): v is string => typeof v === "string");
    const label = values[0] ?? "";
    const price = typeof row.Prix === "string" ? row.Prix : values[1];
    if (!/^séjour à l/i.test(label)) continue;
    if (!label.trim().toLowerCase().endsWith(`— ${tier}`)) continue;
    return price ? parsePriceText(price) : null;
  }
  return null;
}

/** Ce que le Menu de la Taverne rend pour un emplacement (même forme que `GeneratorSlotResult`, réduite à ce qui sert ici). */
export interface MenuSlotDraw {
  key: string;
  text: string;
  price?: OfferPrice;
  items?: { text: string; price?: OfferPrice }[];
}

/** Rubrique d'un emplacement du Menu, d'après le préfixe de sa clé (`entree-simple`, `boisson-alcool`…). */
function groupForMenuSlot(key: string): PriceListGroup | null {
  if (key.startsWith("entree-")) return "starters";
  if (key.startsWith("plat-")) return "mains";
  if (key.startsWith("dessert-")) return "desserts";
  if (key.startsWith("boisson-")) return "drinks";
  return null;
}

/**
 * Les offres d'un tirage du Menu. Un plat sans prix est sauté (il ne
 * s'achèterait pas) ; un plat déjà servi par un autre palier aussi (une
 * taverne modeste tire deux fois sur la même table). Identifiants stables :
 * `<rubrique>-<rang>`.
 */
export function offersFromMenuSlots(slots: readonly MenuSlotDraw[]): PriceListOffer[] {
  const offers: PriceListOffer[] = [];
  const seen = new Set<string>();
  const counts: Partial<Record<PriceListGroup, number>> = {};

  function push(group: PriceListGroup, label: string, price: OfferPrice | undefined) {
    const clean = label.trim();
    if (!price || clean === "" || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    const rank = (counts[group] ?? 0) + 1;
    counts[group] = rank;
    offers.push({ id: `${group}-${rank}`, label: clean, group, price });
  }

  for (const slot of slots) {
    const group = groupForMenuSlot(slot.key);
    if (!group) continue;
    if (slot.items && slot.items.length > 0) {
      for (const item of slot.items) push(group, item.text, item.price);
    } else {
      push(group, slot.text, slot.price);
    }
  }
  return offers;
}

/** La carte complète d'un lieu : la nuit d'abord (si la fiche Train de vie la donne), puis le Menu. */
export function buildPriceList(params: {
  wealth: string | null;
  seed: number | null;
  lodging: OfferPrice | null;
  menuSlots: readonly MenuSlotDraw[];
}): PriceListBlockData {
  const lodging: PriceListOffer[] = params.lodging
    ? [{ id: "lodging-1", label: "Une nuit à l'auberge", group: "lodging", price: params.lodging }]
    : [];
  return { __v: 1, wealth: params.wealth, seed: params.seed, offers: [...lodging, ...offersFromMenuSlots(params.menuSlots)] };
}

/**
 * Graine stable tirée de l'identifiant d'un lieu (FNV-1a 32 bits) : tirer la
 * carte du même lieu redonne la même carte, sans rien stocker avant le
 * premier tirage (ADR 0104 : un détail se fige quand on le découvre).
 */
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
