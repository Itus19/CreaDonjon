import type { InventoryBlockData } from "../schemas/blocks/inventory";
import type { TradeGiveLine, TradeReceiveLine } from "./trade";

/**
 * ADR 0123 — Ce qu'un pillard prend à quelqu'un à terre : toute la bourse,
 * et ce qu'il tient en main et qui se voit. Jamais un objet caché, ni le
 * fond du sac, ni ce qu'il porte sur lui : le pillard lâche vite, et ôter
 * une armure prend des minutes. Rend les deux moitiés d'un même transfert : ce qui sort du sac de
 * la victime (`give`) entre tel quel dans celui du pillard (`receive`), par
 * le même règlement que les échanges (`settleTrade`). Pur.
 */
/** Un emplacement de main (`main_hand`, `off_hand`, `two_hands`…). */
const enMain = (slot: string | undefined): boolean => slot !== undefined && /hand/.test(slot);

export function butinVisible(inventaire: InventoryBlockData): { give: TradeGiveLine[]; receive: TradeReceiveLine[]; objets: number } {
  const give: TradeGiveLine[] = [];
  const receive: TradeReceiveLine[] = [];
  const { extra, ...courantes } = inventaire.currency;
  for (const [coin, amount] of [...Object.entries(courantes), ...Object.entries(extra ?? {})]) {
    if (amount > 0) {
      give.push({ kind: "coins", coin, amount });
      receive.push({ kind: "coins", coin, amount });
    }
  }
  let objets = 0;
  for (const item of inventaire.items) {
    if (!item.equipped || !enMain(item.slot) || item.concealed || item.qty <= 0) continue;
    give.push({ kind: "item", itemId: item.id, qty: item.qty });
    receive.push({ kind: "item", item: "ref" in item ? { ref: item.ref } : { label: item.label }, qty: item.qty });
    objets++;
  }
  return { give, receive, objets };
}
