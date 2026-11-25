import { applyCurrencyDelta, coinValueCp, totalValueCp, DEFAULT_CURRENCY_SYSTEM, type CurrencyDelta, type CurrencySystem } from "./currency";
import type { InventoryBlockData, InventoryItem } from "../schemas/blocks/inventory";
import type { BlockReference } from "../schemas/blocks/reference";

/**
 * V3.2-8 (ADR 0110) — un échange, réglé par le moteur. Pur : aucune lecture,
 * aucun hasard. Le prix vient d'ailleurs (`priceList.ts`) ; ici on vérifie
 * seulement que la personne qui joue a ce qu'elle donne, puis on calcule son
 * nouvel inventaire. Un échange court n'est pas une erreur : il rend la liste
 * de ce qui manque, que le PNJ jouera (V3.2-10, 11).
 */

/** Ce que la personne donne : des pièces, ou un objet de son sac (par son identifiant d'inventaire). */
export type TradeGiveLine = { kind: "coins"; coin: string; amount: number } | { kind: "item"; itemId: string; qty: number };

/** Un objet reçu : une fiche de règle ou du wiki (`ref`), ou un objet libre (`label`). */
export type ReceivedItem = { ref: BlockReference } | { label: string };

/** Ce qu'elle reçoit : des pièces, un objet qui entre dans son sac, ou un service (une nuit, un repas) qui n'y entre pas. */
export type TradeReceiveLine = { kind: "coins"; coin: string; amount: number } | { kind: "item"; item: ReceivedItem; qty: number } | { kind: "service"; label: string };

export interface Trade {
  give: TradeGiveLine[];
  receive: TradeReceiveLine[];
}

export type TradeMissing = { kind: "coins"; missingCp: number } | { kind: "item"; itemId: string; missingQty: number };

export type TradeOutcome = { status: "settled"; inventory: InventoryBlockData } | { status: "short"; missing: TradeMissing[] };

function assertPositive(qty: number, what: string) {
  if (!Number.isFinite(qty) || qty <= 0) throw new RangeError(`Quantité invalide pour ${what} : ${qty}`);
}

/** Même objet, au sens de la pile : même fiche visée, ou même libellé libre. */
function sameItem(item: InventoryItem, received: ReceivedItem): boolean {
  if ("ref" in received) {
    if (!("ref" in item)) return false;
    if (item.ref.kind !== received.ref.kind) return false;
    return item.ref.kind === "rule" && received.ref.kind === "rule" ? item.ref.key === received.ref.key : item.ref.kind === "entity" && received.ref.kind === "entity" && item.ref.id === received.ref.id;
  }
  return "label" in item && item.label.trim().toLowerCase() === received.label.trim().toLowerCase();
}

/**
 * Règle l'échange. Les objets donnés sont vérifiés d'abord (présence et
 * quantité, deux lignes du même objet s'additionnent), puis les pièces : le
 * solde des pièces reçues moins les pièces données passe par
 * `applyCurrencyDelta`, qui rend la monnaie et ne casse les réserves qu'au
 * besoin. Tout ce qui manque est listé ensemble, et rien ne change.
 *
 * Un objet reçu rejoint la pile du même objet, sauf si elle est équipée ou
 * harmonisée (on ne fond pas une arme en main avec une neuve) ; sinon il
 * entre sous un identifiant donné par `newItemId`.
 */
export function settleTrade(
  inventory: InventoryBlockData,
  trade: Trade,
  newItemId: () => string,
  system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM
): TradeOutcome {
  const missing: TradeMissing[] = [];

  // 1. Objets donnés.
  const wanted = new Map<string, number>();
  for (const line of trade.give) {
    if (line.kind !== "item") continue;
    assertPositive(line.qty, line.itemId);
    wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + line.qty);
  }
  for (const [itemId, qty] of wanted) {
    const held = inventory.items.find((i) => i.id === itemId)?.qty ?? 0;
    if (held < qty) missing.push({ kind: "item", itemId, missingQty: qty - held });
  }

  // 2. Pièces : un seul solde par pièce.
  const delta: CurrencyDelta = {};
  const coinLines = [...trade.give.map((line) => ({ line, sign: -1 })), ...trade.receive.map((line) => ({ line, sign: 1 }))];
  for (const { line, sign } of coinLines) {
    if (line.kind !== "coins") continue;
    assertPositive(line.amount, line.coin);
    delta[line.coin] = (delta[line.coin] ?? 0) + sign * line.amount;
  }
  const currency = applyCurrencyDelta(inventory.currency, delta, system);
  if (!currency) {
    const balanceCp = Object.entries(delta).reduce((sum, [coin, n]) => sum + (n ?? 0) * coinValueCp(coin, system), 0);
    missing.push({ kind: "coins", missingCp: -balanceCp - totalValueCp(inventory.currency, system) });
  }

  if (missing.length > 0 || !currency) return { status: "short", missing };

  // 3. Le nouvel inventaire.
  let items = inventory.items
    .map((item) => (wanted.has(item.id) ? { ...item, qty: item.qty - wanted.get(item.id)! } : item))
    .filter((item) => !(wanted.has(item.id) && item.qty <= 0));
  const gone = new Set(inventory.items.filter((i) => !items.some((k) => k.id === i.id)).map((i) => i.id));

  for (const line of trade.receive) {
    if (line.kind !== "item") continue;
    assertPositive(line.qty, "objet reçu");
    const pile = items.find((i) => sameItem(i, line.item) && !i.equipped && !i.attuned);
    if (pile) {
      items = items.map((i) => (i === pile ? { ...i, qty: i.qty + line.qty } : i));
    } else {
      items = [...items, { id: newItemId(), ...line.item, qty: line.qty }];
    }
  }

  const containers = inventory.containers.map((c) => ({ ...c, contains: c.contains.filter((id) => !gone.has(id)) }));
  return { status: "settled", inventory: { ...inventory, items, containers, currency } };
}
