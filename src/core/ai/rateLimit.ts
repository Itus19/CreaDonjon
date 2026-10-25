export interface RateLimitDecision {
  allowed: boolean;
  /** Present seulement quand `allowed` est faux. */
  retryAfterMs?: number;
  /**
   * Appels encore disponibles dans la fenetre, jamais negatif (V3.1-65) :
   * l'encart d'assistance IA affiche « ce qu'il reste » avant de proposer.
   * Calcule ici et nulle part ailleurs — une soustraction refaite dans
   * l'interface divergerait le jour ou la limite changerait.
   */
  remaining: number;
}

export interface RateLimitInput {
  countInWindow: number;
  limit: number;
  windowMs: number;
  /** Age du plus ancien appel compte dans la fenetre, s'il est connu — permet un delai d'attente precis plutot que la fenetre entiere. */
  oldestCallAgeMs?: number;
}

/**
 * Decide si un appel IA est autorise etant donne le compte glissant deja
 * effectue par l'appelant (V1-F1). Pure et sans horloge : le temps reel
 * (fenetre, age du plus ancien appel) est mesure par la couche serveur qui
 * interroge `ai_usage_log`, pour garder cette decision testable en
 * millisecondes.
 */
export function decideRateLimit(input: RateLimitInput): RateLimitDecision {
  const remaining = Math.max(0, input.limit - input.countInWindow);
  if (input.countInWindow < input.limit) return { allowed: true, remaining };
  const retryAfterMs =
    input.oldestCallAgeMs === undefined ? input.windowMs : Math.max(0, input.windowMs - input.oldestCallAgeMs);
  return { allowed: false, retryAfterMs, remaining };
}
