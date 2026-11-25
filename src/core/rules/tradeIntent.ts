import { firstMatch, type IntentTarget } from "./intent";
import { COIN_VALUE_CP } from "./currency";
import type { Trade, TradeReceiveLine } from "./trade";
import { priceCp } from "./priceList";
import type { PriceListOffer } from "../schemas/blocks/priceList";

/**
 * V3.2-10 (ADR 0110) — lire un achat, une vente ou un don dans « Que fais-tu ? ».
 *
 * Même discipline que `interpretIntent` : une lecture déterministe, sans
 * dé ni écriture, faite dans le navigateur pour s'afficher en frappant. Le
 * serveur ne reçoit que le choix retenu et recalcule le prix lui-même : un
 * prix qui viendrait du client ne vaut rien.
 *
 * **Un verbe ET un objet du catalogue**, jamais l'un sans l'autre. « Je
 * prends la porte de gauche » n'est pas un achat : la porte n'est pas à la
 * carte. Et une offre nommée sans verbe d'échange (« la bière est tiède »)
 * n'en est pas un non plus. Ce qui n'est pas reconnu retombe dans la
 * lecture ordinaire (jet ou action libre).
 *
 * Les montants sont en pièces de cuivre : c'est l'unité où une revente à
 * moitié prix tombe juste (`resaleCp`, `priceList.ts`).
 */

export type TradeDirection = "buy" | "sell" | "give";

export interface TradeVerb {
  direction: TradeDirection;
  terms: string[];
}

/** Une offre de la carte du lieu (bloc `price_list`). */
export interface TradeOfferEntry {
  id: string;
  label: string;
  terms: string[];
  priceCp: number;
  /** Une offre qui renvoie à une fiche de règle entre dans le sac ; sinon c'est un service, consommé sur place. */
  ruleKey: string | null;
}

/** Un objet du sac de la personne qui joue. */
export interface TradeItemEntry {
  /** L'identifiant de l'objet dans l'inventaire. */
  id: string;
  label: string;
  terms: string[];
  /** La moitié du prix de sa fiche de règle ; `null` si aucun prix n'est connu (objet libre, artéfact). */
  resaleCp: number | null;
}

export interface TradeCatalog {
  verbs: TradeVerb[];
  offers: TradeOfferEntry[];
  items: TradeItemEntry[];
  /** La bourse, pour dire « tu as 3 pa sur 5 » ; le serveur revérifie au règlement. */
  purseCp: number;
  /** Le lieu de la scène porte-t-il une carte ? Sans elle, un achat propose de la tirer. */
  hasPriceList: boolean;
}

export interface TradeReading {
  kind: "trade";
  direction: TradeDirection;
  /** L'offre (achat) ou l'objet du sac (vente, don). */
  entryId: string;
  label: string;
  /** Ce que la personne paie (achat) ou reçoit (vente) ; `null` pour un don ou une vente sans prix connu. */
  priceCp: number | null;
  target: IntentTarget | null;
  matched: { verb: string; object: string; target: string | null };
}

/** Un verbe d'achat dans un lieu sans carte : l'écran propose de la tirer. */
export interface NoPriceListReading {
  kind: "no_price_list";
  verb: string;
}

function indexedVerbs(verbs: readonly TradeVerb[]): (TradeVerb & { id: string })[] {
  return verbs.map((verb, index) => ({ ...verb, id: String(index) }));
}

export function interpretTrade(rawText: string, catalog: TradeCatalog, targets: readonly IntentTarget[]): TradeReading | NoPriceListReading | null {
  const text = rawText.trim();
  if (text.length === 0) return null;

  const verbHit = firstMatch(text, indexedVerbs(catalog.verbs));
  if (!verbHit) return null;
  const direction = verbHit.item.direction;

  const objectHit = direction === "buy" ? firstMatch(text, catalog.offers) : firstMatch(text, catalog.items);
  if (!objectHit) {
    return direction === "buy" && !catalog.hasPriceList ? { kind: "no_price_list", verb: verbHit.matchedText } : null;
  }

  const targetHit = firstMatch(text, targets);
  const entry = objectHit.item;
  const priceCp = direction === "buy" ? (entry as TradeOfferEntry).priceCp : direction === "sell" ? (entry as TradeItemEntry).resaleCp : null;
  return {
    kind: "trade",
    direction,
    entryId: entry.id,
    label: entry.label,
    priceCp,
    target: targetHit?.item ?? null,
    matched: { verb: verbHit.matchedText, object: objectHit.matchedText, target: targetHit?.matchedText ?? null },
  };
}

/**
 * Les offres d'une carte (bloc `price_list`) en entrées du catalogue. La nuit
 * à l'auberge se dit aussi « la chambre », « un lit » (`lodgingTerms`, le
 * lexique français est passé par l'appelant). Partagé par le serveur, qui
 * construit le catalogue, et par l'écran, qui reçoit une carte tout juste tirée.
 */
export function tradeOffersFromPriceList(offers: readonly PriceListOffer[], lodgingTerms: readonly string[]): TradeOfferEntry[] {
  return offers.map((offer) => ({
    id: offer.id,
    label: offer.label,
    terms: offer.group === "lodging" ? [offer.label, ...lodgingTerms] : [offer.label],
    priceCp: priceCp(offer.price),
    ruleKey: offer.rule_key ?? null,
  }));
}

/** Les pièces courantes, de la plus grosse à la plus petite : on ne forme jamais de platine ni d'électrum (ADR 0036). */
const COMMON_COINS = ["gp", "sp", "cp"] as const;

/** Un montant en cuivre, composé en or, argent et cuivre : 1 234 pc → 12 po, 3 pa, 4 pc. */
export function splitCp(cp: number): { coin: (typeof COMMON_COINS)[number]; amount: number }[] {
  if (!Number.isInteger(cp) || cp < 0) throw new RangeError(`Montant invalide : ${cp}`);
  const parts: { coin: (typeof COMMON_COINS)[number]; amount: number }[] = [];
  let rest = cp;
  for (const coin of COMMON_COINS) {
    const amount = Math.floor(rest / COIN_VALUE_CP[coin]);
    if (amount > 0) parts.push({ coin, amount });
    rest -= amount * COIN_VALUE_CP[coin];
  }
  return parts;
}

function coinLines(cp: number): { kind: "coins"; coin: string; amount: number }[] {
  return splitCp(cp).map((p) => ({ kind: "coins" as const, coin: p.coin, amount: p.amount }));
}

/** Acheter une offre : son prix contre un objet de règle, ou un service. */
export function tradeForOffer(offer: TradeOfferEntry): Trade {
  const receive: TradeReceiveLine = offer.ruleKey
    ? { kind: "item", item: { ref: { kind: "rule", key: offer.ruleKey } }, qty: 1 }
    : { kind: "service", label: offer.label };
  return { give: coinLines(offer.priceCp), receive: [receive] };
}

/** Vendre un objet du sac : il sort, son prix de revente entre. */
export function tradeForSale(itemId: string, resaleCp: number): Trade {
  return { give: [{ kind: "item", itemId, qty: 1 }], receive: coinLines(resaleCp) };
}

/** Donner un objet du sac : il sort, rien n'entre. */
export function tradeForGift(itemId: string): Trade {
  return { give: [{ kind: "item", itemId, qty: 1 }], receive: [] };
}
