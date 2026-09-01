/** Porte-monnaie d'un inventaire (`InventoryBlockData.currency`, cf. src/core/schemas/blocks/inventory.ts). */
export interface Currency {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
}

/** Du plus gros au plus petit — ordre utilise par `recompose` pour reconstituer le porte-monnaie. */
export const CURRENCY_ORDER = ["pp", "gp", "ep", "sp", "cp"] as const;
export type CoinType = (typeof CURRENCY_ORDER)[number];

/** Taux d'echange standard (SRD) : valeur d'une piece de chaque denomination en pieces de cuivre. */
export const COIN_VALUE_CP: Record<CoinType, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };

/** Valeur totale en pieces de cuivre — seul denominateur commun pour comparer/additionner des portes-monnaies de repartitions differentes (V2-M12, stats de campagne). */
export function totalValueCp(currency: Currency): number {
  return CURRENCY_ORDER.reduce((sum, c) => sum + currency[c] * COIN_VALUE_CP[c], 0);
}

/** Reconstitue un porte-monnaie a partir d'une valeur totale, avec le moins de pieces possible (glouton, du plus gros au plus petit). */
function recompose(totalCp: number): Currency {
  let remaining = totalCp;
  const result = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } as Currency;
  for (const c of CURRENCY_ORDER) {
    result[c] = Math.floor(remaining / COIN_VALUE_CP[c]);
    remaining -= result[c] * COIN_VALUE_CP[c];
  }
  return result;
}

/**
 * Depot : ajoute `amount` pieces de type `coin`, puis recompose tout le
 * porte-monnaie avec le moins de pieces possible — meme logique que
 * `spendCoins`, dans l'autre sens (ex. 9 po + 1 po devient 1 pp). Symetrique
 * par construction : les deux operations partagent `recompose`.
 */
export function depositCoins(currency: Currency, coin: CoinType, amount: number): Currency {
  return recompose(totalValueCp(currency) + amount * COIN_VALUE_CP[coin]);
}

/**
 * Depense : retire `amount` pieces de type `coin`. Si ce type n'en a pas
 * assez, casse automatiquement des pieces plus grosses selon le taux
 * d'echange standard puis recompose tout le porte-monnaie avec le moins de
 * pieces possible — c'est la maniere la plus previsible de rendre la
 * monnaie, et elle ne depend jamais de la repartition de depart. Renvoie
 * `null` si la valeur totale ne suffit pas ; le porte-monnaie n'est alors
 * jamais modifie.
 */
export function spendCoins(currency: Currency, coin: CoinType, amount: number): Currency | null {
  const costCp = amount * COIN_VALUE_CP[coin];
  const totalCp = totalValueCp(currency);
  if (totalCp < costCp) return null;
  return recompose(totalCp - costCp);
}
