/** Porte-monnaie d'un inventaire (`InventoryBlockData.currency`, cf. src/core/schemas/blocks/inventory.ts). */
export interface Currency {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
}

/** Du plus gros au plus petit — ordre d'affichage et de parcours des pieces. */
export const CURRENCY_ORDER = ["pp", "gp", "ep", "sp", "cp"] as const;
export type CoinType = (typeof CURRENCY_ORDER)[number];

/** Taux d'echange standard (SRD) : valeur d'une piece de chaque denomination en pieces de cuivre. */
export const COIN_VALUE_CP: Record<CoinType, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };

/** Valeur totale en pieces de cuivre — seul denominateur commun pour comparer/additionner des portes-monnaies de repartitions differentes (V2-M12, stats de campagne). */
export function totalValueCp(currency: Currency): number {
  return CURRENCY_ORDER.reduce((sum, c) => sum + currency[c] * COIN_VALUE_CP[c], 0);
}

/**
 * Pieces courantes et pieces de reserve (decision de l'auteur, 13 octobre,
 * qui etend celle du 4 octobre sur l'electrum, ADR 0036 §1). La monnaie se
 * compose en or, argent et cuivre, les pieces de tous les jours. Le platine
 * et l'electrum sont une RESERVE : on n'en forme jamais, on garde ceux qu'on
 * detient, et on ne les casse que si l'or, l'argent et le cuivre ne suffisent
 * pas — l'electrum d'abord (la plus petite), au plus juste.
 */
const COMMON_COINS = ["gp", "sp", "cp"] as const;
const RESERVE_BREAK_ORDER = ["ep", "pp"] as const;
type ReserveCoin = (typeof RESERVE_BREAK_ORDER)[number];

function isReserve(coin: CoinType): coin is ReserveCoin {
  return coin === "ep" || coin === "pp";
}

/** Reconstitue po/pa/pc a partir d'une valeur en pieces de cuivre, avec le moins de pieces possible ; pp et pe valent `0`, l'appelant y remet sa reserve. */
function recomposeCommon(totalCp: number): Currency {
  let remaining = totalCp;
  const result: Currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  for (const c of COMMON_COINS) {
    result[c] = Math.floor(remaining / COIN_VALUE_CP[c]);
    remaining -= result[c] * COIN_VALUE_CP[c];
  }
  return result;
}

/** Valeur de l'or, de l'argent et du cuivre, en pieces de cuivre. */
function commonValueCp(currency: Currency): number {
  return COMMON_COINS.reduce((sum, c) => sum + currency[c] * COIN_VALUE_CP[c], 0);
}

/**
 * Depot : ajoute `amount` pieces de type `coin`. Or, argent et cuivre se
 * regroupent avec le moins de pieces possible, sans jamais monter en platine
 * (9 po + 1 po = 10 po ; 99 pa + 1 pa = 10 po). Deposer du platine ou de
 * l'electrum l'ajoute simplement a la reserve detenue.
 */
export function depositCoins(currency: Currency, coin: CoinType, amount: number): Currency {
  if (isReserve(coin)) return { ...currency, [coin]: currency[coin] + amount };
  return { ...recomposeCommon(commonValueCp(currency) + amount * COIN_VALUE_CP[coin]), pp: currency.pp, ep: currency.ep };
}

/**
 * Depense : retire `amount` pieces de type `coin`, en rendant la monnaie en
 * or, argent et cuivre. Depenser une piece de reserve consomme d'abord celles
 * qu'on detient. Sinon la reserve n'est cassee que si l'or, l'argent et le
 * cuivre ne suffisent pas : l'electrum d'abord, puis le platine, une piece a
 * la fois et seulement ce qu'il faut ; les pieces non cassees restent en
 * reserve. Renvoie `null` si la valeur totale ne suffit pas ; le porte-monnaie
 * n'est alors jamais modifie.
 */
export function spendCoins(currency: Currency, coin: CoinType, amount: number): Currency | null {
  let costCp = amount * COIN_VALUE_CP[coin];
  if (totalValueCp(currency) < costCp) return null;

  const reserve: Record<ReserveCoin, number> = { pp: currency.pp, ep: currency.ep };
  if (isReserve(coin)) {
    const used = Math.min(reserve[coin], amount);
    reserve[coin] -= used;
    costCp -= used * COIN_VALUE_CP[coin];
  }

  let commonCp = commonValueCp(currency);
  for (const r of RESERVE_BREAK_ORDER) {
    if (commonCp >= costCp) break;
    const broken = Math.min(reserve[r], Math.ceil((costCp - commonCp) / COIN_VALUE_CP[r]));
    reserve[r] -= broken;
    commonCp += broken * COIN_VALUE_CP[r];
  }
  return { ...recomposeCommon(commonCp - costCp), pp: reserve.pp, ep: reserve.ep };
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
