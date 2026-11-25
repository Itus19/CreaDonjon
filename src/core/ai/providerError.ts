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

/** Un modèle que l'offre du compte n'inclut pas. */
const HORS_OFFRE = /tier_not_allowed|subscription tier|not available in your (plan|tier|subscription)|not allowed for (this|your) (plan|tier)/i;

/**
 * Classe une réponse HTTP en échec. Pure : les corps d'erreur ne suivent
 * aucune norme commune, on reconnaît donc des mots, pas une structure.
 */
export function classerReponseFournisseur(status: number, corps: string): Exclude<RaisonSansNarration, "aucun_fournisseur" | "delai" | "inutilisable" | "limite_app"> {
  if (status === 402) return "quota";
  if (status === 429) return QUOTA.test(corps) ? "quota" : "limite";
  // Un 403 peut aussi dire « ce modèle n'est pas dans ton offre » (Mistral,
  // `tier_not_allowed`) : la clé est bonne, c'est la requête qui est refusée.
  if (status === 403 && HORS_OFFRE.test(corps)) return "refusee";
  if (status === 401 || status === 403) return "cle_refusee";
  if (status === 400 || status === 404 || status === 422) return "refusee";
  return "echec";
}

/** Ce qui ressemble à une clé d'API : un préfixe connu, ou une longue suite sans espace. */
const RESSEMBLE_A_UNE_CLE = /\b(sk|pk|rk|key|xai|gsk|AIza)[-_A-Za-z0-9]{16,}|\b[A-Za-z0-9_-]{32,}\b/g;
const LONGUEUR_MAX_MESSAGE = 200;

function champTexte(objet: unknown, cle: string): string | undefined {
  if (typeof objet !== "object" || objet === null) return undefined;
  const valeur = (objet as Record<string, unknown>)[cle];
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : undefined;
}

function champObjet(objet: unknown, cle: string): unknown {
  return typeof objet === "object" && objet !== null ? (objet as Record<string, unknown>)[cle] : undefined;
}

/**
 * La phrase utile d'un refus, pour l'écran : `error.metadata.raw` (OpenRouter,
 * la cause d'origine), sinon `error.message` (OpenAI), sinon `message`
 * (Mistral), sinon le texte brut. Pure.
 *
 * Elle part vers le navigateur de la personne qui a déclaré ce fournisseur :
 * tout ce qui ressemble à une clé est masqué, au cas où un fournisseur la
 * recopierait dans son message d'erreur.
 */
export function extraireMessageFournisseur(status: number, corps: string): string {
  let message: string | undefined;
  try {
    const json: unknown = JSON.parse(corps);
    const erreur = champObjet(json, "error");
    message = champTexte(champObjet(erreur, "metadata"), "raw") ?? champTexte(erreur, "message") ?? champTexte(json, "message");
  } catch {
    // catch-attendu : un corps qui n'est pas du JSON se montre tel quel.
  }
  const texte = (message ?? corps).replace(/\s+/g, " ").trim().replace(RESSEMBLE_A_UNE_CLE, "[masqué]");
  if (texte === "") return `${status}, sans message`;
  return `${status} : ${texte.length > LONGUEUR_MAX_MESSAGE ? `${texte.slice(0, LONGUEUR_MAX_MESSAGE - 1)}…` : texte}`;
}
