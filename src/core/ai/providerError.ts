/**
 * Pourquoi un tour solo est resté sans narration, tel que l'écran le dit.
 *
 * La narration est best-effort (`specs/cible-locale-et-ia.md` §4) : le tour
 * est joué quoi qu'il arrive. Mais un tour muet sans explication laisse le
 * joueur deviner (V3.1-223). Avec un fournisseur distant payant, la cause la
 * plus fréquente devient le crédit ou le quota épuisé : elle a son propre
 * message.
 */
export type RaisonSansNarration =
  /** Aucun fournisseur déclaré sur le compte ni dans l'environnement. */
  | "aucun_fournisseur"
  /** Crédit épuisé, quota du jour ou du mois atteint. */
  | "quota"
  /** Trop d'appels d'un coup chez le fournisseur : réessayer plus tard suffit. */
  | "limite"
  /** La limite de l'app elle-même (appels par heure et par compte, `src/server/ai/rateLimit.ts`). */
  | "limite_app"
  /** Clé absente, fausse ou révoquée. */
  | "cle_refusee"
  /** Le fournisseur n'a pas répondu dans le délai. */
  | "delai"
  /**
   * Le fournisseur a répondu, mais refusé la requête (400, 404, 422) : modèle
   * inconnu, modèle qui ne gère pas les outils ou ne produit pas de texte,
   * adresse qui ne mène pas à l'API.
   */
  | "refusee"
  /** Le modèle a répondu, mais sans récit utilisable (aucun appel d'outil, sortie hors schéma). */
  | "inutilisable"
  /** Tout le reste : injoignable, réponse invalide, panne du fournisseur. */
  | "echec";

/** Les formulations des fournisseurs pour « il n'y a plus de quoi payer » ou « quota du jour atteint ». */
const QUOTA = /insufficient[_ ]quota|exceeded your current quota|insufficient[_ ](credits?|balance|funds)|out of credits|per[- ]day|daily|\bTPD\b|\bRPD\b|quota/i;

/**
 * Classe une réponse HTTP en échec. Pure : les corps d'erreur ne suivent
 * aucune norme commune, on reconnaît donc des mots, pas une structure.
 */
export function classerReponseFournisseur(status: number, corps: string): Exclude<RaisonSansNarration, "aucun_fournisseur" | "delai" | "inutilisable" | "limite_app"> {
  if (status === 402) return "quota";
  if (status === 429) return QUOTA.test(corps) ? "quota" : "limite";
  if (status === 401 || status === 403) return "cle_refusee";
  if (status === 400 || status === 404 || status === 422) return "refusee";
  return "echec";
}
