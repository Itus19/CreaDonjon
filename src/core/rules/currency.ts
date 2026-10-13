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

/**
 * Reconstitue pp/po/pa/pc a partir d'une valeur en pieces de cuivre, avec le
 * moins de pieces possible (glouton, du plus gros au plus petit). **L'electrum
 * est exclu du regroupement** (decision de l'auteur, ADR 0036 §1) : on n'en
 * forme jamais ; `ep` vaut `0` ici et l'appelant y remet celui qu'on detient.
 */
function recomposeWithoutElectrum(totalCp: number): Currency {
  let remaining = totalCp;
  const result: Currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  for (const c of CURRENCY_ORDER) {
    if (c === "ep") continue;
    result[c] = Math.floor(remaining / COIN_VALUE_CP[c]);
    remaining -= result[c] * COIN_VALUE_CP[c];
  }
  return result;
}

/** Valeur du porte-monnaie hors electrum, en pieces de cuivre. */
function valueWithoutElectrumCp(currency: Currency): number {
  return totalValueCp(currency) - currency.ep * COIN_VALUE_CP.ep;
}

/**
 * Depot : ajoute `amount` pieces de type `coin`, puis recompose pp/po/pa/pc
 * avec le moins de pieces possible (ex. 9 po + 1 po devient 1 pp). L'electrum
 * detenu reste tel quel et on n'en forme jamais ; deposer de l'electrum
 * l'ajoute simplement aux pe detenues.
 */
export function depositCoins(currency: Currency, coin: CoinType, amount: number): Currency {
  if (coin === "ep") return { ...recomposeWithoutElectrum(valueWithoutElectrumCp(currency)), ep: currency.ep + amount };
  const next = recomposeWithoutElectrum(valueWithoutElectrumCp(currency) + amount * COIN_VALUE_CP[coin]);
  return { ...next, ep: currency.ep };
}

/**
 * Depense : retire `amount` pieces de type `coin`. Si ce type n'en a pas
 * assez, casse automatiquement des pieces plus grosses selon le taux
 * d'echange standard puis recompose avec le moins de pieces possible — la
 * maniere la plus previsible de rendre la monnaie. L'electrum detenu n'est
 * touche qu'en dernier recours : quand on depense des pe, elles partent
 * d'abord ; sinon il ne se casse que si le reste ne suffit pas, et ce qui
 * n'est pas consomme reste en pe. Renvoie `null` si la valeur totale ne
 * suffit pas ; le porte-monnaie n'est alors jamais modifie.
 */
export function spendCoins(currency: Currency, coin: CoinType, amount: number): Currency | null {
  let costCp = amount * COIN_VALUE_CP[coin];
  if (totalValueCp(currency) < costCp) return null;

  let electrum = currency.ep;
  if (coin === "ep") {
    const used = Math.min(electrum, amount);
    electrum -= used;
    costCp -= used * COIN_VALUE_CP.ep;
  }

  const restCp = valueWithoutElectrumCp(currency);
  if (restCp >= costCp) return { ...recomposeWithoutElectrum(restCp - costCp), ep: electrum };

  // Le reste ne suffit pas : on entame l'electrum, et ce qui en reste en pieces entieres reste en pe.
  const leftCp = restCp + electrum * COIN_VALUE_CP.ep - costCp;
  const keptElectrum = Math.floor(leftCp / COIN_VALUE_CP.ep);
  return { ...recomposeWithoutElectrum(leftCp - keptElectrum * COIN_VALUE_CP.ep), ep: keptElectrum };
}

/** Variation du porte-monnaie, par piece : positif = depot, negatif = depense. */
export type CurrencyDelta = Partial<Record<CoinType, number>>;

/**
 * Applique un delta par piece (ADR 0036 §1) : depots d'abord, puis depenses,
 * chacun par `depositCoins` / `spendCoins`. `null` si le total ne suffit pas ;
 * le porte-monnaie d'origine n'est alors jamais modifie.
 */
export function applyCurrencyDelta(currency: Currency, delta: CurrencyDelta): Currency | null {
  let next = currency;
  for (const coin of CURRENCY_ORDER) {
    const amount = delta[coin] ?? 0;
    if (amount > 0) next = depositCoins(next, coin, amount);
  }
  for (const coin of CURRENCY_ORDER) {
    const amount = delta[coin] ?? 0;
    if (amount < 0) {
      const spent = spendCoins(next, coin, -amount);
      if (!spent) return null;
      next = spent;
    }
  }
  return next;
}
