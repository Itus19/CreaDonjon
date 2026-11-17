/** Porte-monnaie d'un inventaire (`InventoryBlockData.currency`, cf. src/core/schemas/blocks/inventory.ts). */
export interface Currency {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
  /** V3.1-217 (ADR 0102) : les pieces maison, par cle `snake_case`. Absent quand il n'y en a aucune. */
  extra?: Record<string, number>;
}

/** Du plus gros au plus petit — ordre d'affichage et de parcours des pieces. */
export const CURRENCY_ORDER = ["pp", "gp", "ep", "sp", "cp"] as const;
export type CoinType = (typeof CURRENCY_ORDER)[number];

/** Taux d'echange standard (SRD) : valeur d'une piece de chaque denomination en pieces de cuivre. */
export const COIN_VALUE_CP: Record<CoinType, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };

/** Une piece d'un systeme monetaire (bloc `currency_system`, ADR 0102). */
export interface CurrencyCoin {
  key: string;
  label: Record<string, string>;
  /** Sa valeur en pieces de cuivre, entier positif. */
  value_cp: number;
  /** `common` : elle se forme et se regroupe ; `reserve` : gardee, cassee au besoin. */
  role: "common" | "reserve";
}

/** Un systeme monetaire : ses pieces et l'ordre de casse des reserves. */
export interface CurrencySystem {
  coins: CurrencyCoin[];
  break_order: string[];
}

/**
 * Pieces courantes et pieces de reserve (decision de l'auteur, 13 octobre,
 * qui etend celle du 4 octobre sur l'electrum, ADR 0036 §1). La monnaie se
 * compose en or, argent et cuivre, les pieces de tous les jours. Le platine
 * et l'electrum sont une RESERVE : on n'en forme jamais, on garde ceux qu'on
 * detient, et on ne les casse que si l'or, l'argent et le cuivre ne suffisent
 * pas — l'electrum d'abord (la plus petite), au plus juste.
 *
 * Depuis V3.1-217 (ADR 0102), c'est le systeme PAR DEFAUT : une variante le
 * remplace par un bloc `currency_system` sur la fiche « Pieces de monnaie ».
 */
export const DEFAULT_CURRENCY_SYSTEM: CurrencySystem = {
  coins: [
    { key: "pp", label: { fr: "Platine", en: "Platinum" }, value_cp: 1000, role: "reserve" },
    { key: "gp", label: { fr: "Or", en: "Gold" }, value_cp: 100, role: "common" },
    { key: "ep", label: { fr: "Électrum", en: "Electrum" }, value_cp: 50, role: "reserve" },
    { key: "sp", label: { fr: "Argent", en: "Silver" }, value_cp: 10, role: "common" },
    { key: "cp", label: { fr: "Cuivre", en: "Copper" }, value_cp: 1, role: "common" },
  ],
  break_order: ["ep", "pp"],
};

/** Une piece est-elle l'une des cinq cases fixes du porte-monnaie ? */
export function isStandardCoin(key: string): key is CoinType {
  return (CURRENCY_ORDER as readonly string[]).includes(key);
}

/** Combien de pieces `key` le porte-monnaie detient. */
export function coinAmount(currency: Currency, key: string): number {
  return isStandardCoin(key) ? currency[key] : (currency.extra?.[key] ?? 0);
}

/**
 * Valeur d'une piece en pieces de cuivre : celle du systeme ; a defaut, la
 * valeur standard pour une piece SRD ; 0 pour une piece maison inconnue,
 * jamais devinee (ADR 0102).
 */
export function coinValueCp(key: string, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): number {
  const coin = system.coins.find((c) => c.key === key);
  if (coin) return coin.value_cp;
  return isStandardCoin(key) ? COIN_VALUE_CP[key] : 0;
}

/** Les cles que le porte-monnaie detient (cinq cases, plus les pieces maison). */
function heldKeys(currency: Currency): string[] {
  return [...CURRENCY_ORDER, ...Object.keys(currency.extra ?? {})];
}

/** Valeur totale en pieces de cuivre — seul denominateur commun pour comparer/additionner des portes-monnaies de repartitions differentes (V2-M12, stats de campagne). */
export function totalValueCp(currency: Currency, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): number {
  return heldKeys(currency).reduce((sum, k) => sum + coinAmount(currency, k) * coinValueCp(k, system), 0);
}

/** Les pieces courantes, de la plus grosse a la plus petite. */
function commonCoins(system: CurrencySystem): CurrencyCoin[] {
  return system.coins.filter((c) => c.role === "common").sort((a, b) => b.value_cp - a.value_cp);
}

function isCommon(key: string, system: CurrencySystem): boolean {
  return system.coins.some((c) => c.key === key && c.role === "common");
}

/** Pieces detenues, par cle (les cinq cases toujours presentes). */
type Purse = Record<string, number>;

function toPurse(currency: Currency): Purse {
  const purse: Purse = {};
  for (const k of heldKeys(currency)) purse[k] = coinAmount(currency, k);
  return purse;
}

/** Revient a la forme `Currency` : cinq cases, et `extra` seulement s'il reste une piece maison. */
function fromPurse(purse: Purse): Currency {
  const out: Currency = { pp: purse.pp ?? 0, gp: purse.gp ?? 0, ep: purse.ep ?? 0, sp: purse.sp ?? 0, cp: purse.cp ?? 0 };
  const extra: Record<string, number> = {};
  for (const [k, n] of Object.entries(purse)) if (!isStandardCoin(k) && n > 0) extra[k] = n;
  if (Object.keys(extra).length > 0) out.extra = extra;
  return out;
}

/** Valeur des pieces courantes detenues. */
function commonValueCp(purse: Purse, system: CurrencySystem): number {
  return commonCoins(system).reduce((sum, c) => sum + (purse[c.key] ?? 0) * c.value_cp, 0);
}

/** Remplace les pieces courantes par `totalCp` recompose avec le moins de pieces possible ; le reste du porte-monnaie ne bouge pas. */
function recomposeCommon(purse: Purse, totalCp: number, system: CurrencySystem): Purse {
  let remaining = totalCp;
  const next = { ...purse };
  for (const c of commonCoins(system)) {
    next[c.key] = Math.floor(remaining / c.value_cp);
    remaining -= next[c.key]! * c.value_cp;
  }
  return next;
}

/**
 * Depot : ajoute `amount` pieces `coin`. Les pieces courantes se regroupent
 * avec le moins de pieces possible, sans jamais former de reserve (9 po + 1 po
 * = 10 po ; 99 pa + 1 pa = 10 po). Deposer une reserve, ou une piece que le
 * systeme ne connait pas, l'ajoute simplement a ce qu'on detient.
 */
export function depositCoins(currency: Currency, coin: string, amount: number, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): Currency {
  const purse = toPurse(currency);
  if (!isCommon(coin, system)) return fromPurse({ ...purse, [coin]: (purse[coin] ?? 0) + amount });
  return fromPurse(recomposeCommon(purse, commonValueCp(purse, system) + amount * coinValueCp(coin, system), system));
}

/**
 * L'ordre de casse complet : celui du systeme, puis ses autres reserves (de
 * la plus petite a la plus grosse), puis les pieces detenues que le systeme
 * ne connait pas et qui gardent une valeur (pieces SRD), de la plus petite a
 * la plus grosse.
 */
function fullBreakOrder(purse: Purse, system: CurrencySystem): string[] {
  const order = [...system.break_order];
  const ascending = (keys: string[]) => keys.sort((a, b) => coinValueCp(a, system) - coinValueCp(b, system));
  order.push(...ascending(system.coins.filter((c) => c.role === "reserve" && !order.includes(c.key)).map((c) => c.key)));
  const known = new Set(system.coins.map((c) => c.key));
  order.push(...ascending(Object.keys(purse).filter((k) => !known.has(k) && coinValueCp(k, system) > 0)));
  return order;
}

/**
 * Depense : retire `amount` pieces `coin`, en rendant la monnaie en pieces
 * courantes. Depenser une piece non courante consomme d'abord celles qu'on
 * detient. Sinon les reserves ne sont cassees que si les pieces courantes ne
 * suffisent pas, dans l'ordre de casse, une piece a la fois et seulement ce
 * qu'il faut ; les pieces non cassees restent. Renvoie `null` si la valeur
 * totale ne suffit pas ; le porte-monnaie n'est alors jamais modifie. Une
 * piece de valeur nulle (maison inconnue) ne se paie qu'avec elle-meme.
 */
export function spendCoins(currency: Currency, coin: string, amount: number, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): Currency | null {
  const purse = toPurse(currency);
  const value = coinValueCp(coin, system);
  if (value === 0) {
    if ((purse[coin] ?? 0) < amount) return null;
    return fromPurse({ ...purse, [coin]: purse[coin]! - amount });
  }
  let costCp = amount * value;
  if (totalValueCp(currency, system) < costCp) return null;

  if (!isCommon(coin, system)) {
    const used = Math.min(purse[coin] ?? 0, amount);
    purse[coin] = (purse[coin] ?? 0) - used;
    costCp -= used * value;
  }

  let commonCp = commonValueCp(purse, system);
  for (const r of fullBreakOrder(purse, system)) {
    if (commonCp >= costCp) break;
    const rValue = coinValueCp(r, system);
    const broken = Math.min(purse[r] ?? 0, Math.ceil((costCp - commonCp) / rValue));
    purse[r] = (purse[r] ?? 0) - broken;
    commonCp += broken * rValue;
  }
  return fromPurse(recomposeCommon(purse, commonCp - costCp, system));
}

/** Variation du porte-monnaie, par piece : positif = depot, negatif = depense. */
export type CurrencyDelta = Partial<Record<string, number>>;

/**
 * Applique un delta par piece (ADR 0036 §1) : depots d'abord, puis depenses,
 * chacun par `depositCoins` / `spendCoins`, de la piece la plus grosse a la
 * plus petite. `null` si le total ne suffit pas ; le porte-monnaie d'origine
 * n'est alors jamais modifie.
 */
export function applyCurrencyDelta(currency: Currency, delta: CurrencyDelta, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): Currency | null {
  const keys = Object.keys(delta).sort((a, b) => coinValueCp(b, system) - coinValueCp(a, system));
  let next = currency;
  for (const coin of keys) {
    const amount = delta[coin] ?? 0;
    if (amount > 0) next = depositCoins(next, coin, amount, system);
  }
  for (const coin of keys) {
    const amount = delta[coin] ?? 0;
    if (amount < 0) {
      const spent = spendCoins(next, coin, -amount, system);
      if (!spent) return null;
      next = spent;
    }
  }
  return next;
}
