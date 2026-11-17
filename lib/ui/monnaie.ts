import { coinAmount, coinValueCp, CURRENCY_ORDER, isStandardCoin, type Currency, type CurrencySystem } from "@/src/core/rules/currency";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";

/** Une pièce telle que l'inventaire l'affiche (V3.1-219, ADR 0102). */
export interface PieceAffichee {
  key: string;
  /** Court, pour l'en-tête d'un champ étroit : l'abréviation SRD (po, pa…) ou le libellé d'une pièce maison. */
  abbr: string;
  /** Le libellé complet, dans la langue. */
  label: string;
  amount: number;
  /**
   * `known` : du système du monde ; `outside` : une pièce SRD que le système
   * n'a plus (comptée à sa valeur standard, plus formée) ; `unknown` : une
   * pièce maison inconnue (comptée à 0, jamais devinée).
   */
  status: "known" | "outside" | "unknown";
}

const LIBELLES_SRD: Record<string, Record<string, string>> = {
  pp: { fr: "Platine", en: "Platinum" },
  gp: { fr: "Or", en: "Gold" },
  ep: { fr: "Électrum", en: "Electrum" },
  sp: { fr: "Argent", en: "Silver" },
  cp: { fr: "Cuivre", en: "Copper" },
};

/**
 * Les pièces à afficher : celles du système, de la plus grosse à la plus
 * petite ; puis, si on en détient, les pièces hors système (SRD retirée,
 * maison inconnue), signalées. Une pièce SRD garde son abréviation (po, pa…).
 */
export function piecesAffichees(currency: Currency, system: CurrencySystem, locale: string): PieceAffichee[] {
  const dans = (l: Record<string, string>) => l[locale] ?? l.fr ?? Object.values(l)[0] ?? "";
  const connues = [...system.coins].sort((a, b) => b.value_cp - a.value_cp).map<PieceAffichee>((c) => ({
    key: c.key,
    abbr: isStandardCoin(c.key) ? CURRENCY_LABELS_FR[c.key]! : dans(c.label),
    label: dans(c.label),
    amount: coinAmount(currency, c.key),
    status: "known",
  }));
  const vues = new Set(system.coins.map((c) => c.key));
  const horsSysteme = [...CURRENCY_ORDER, ...Object.keys(currency.extra ?? {})]
    .filter((k) => !vues.has(k) && coinAmount(currency, k) > 0)
    .sort((a, b) => coinValueCp(b, system) - coinValueCp(a, system))
    .map<PieceAffichee>((k) =>
      isStandardCoin(k)
        ? { key: k, abbr: CURRENCY_LABELS_FR[k]!, label: dans(LIBELLES_SRD[k]!), amount: coinAmount(currency, k), status: "outside" }
        : { key: k, abbr: k, label: k, amount: coinAmount(currency, k), status: "unknown" }
    );
  return [...connues, ...horsSysteme];
}
