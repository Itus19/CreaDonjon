export interface RateLimitDecision {
  allowed: boolean;
  /** Present seulement quand `allowed` est faux. */
  retryAfterMs?: number;
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
  if (input.countInWindow < input.limit) return { allowed: true };
  const retryAfterMs =
    input.oldestCallAgeMs === undefined ? input.windowMs : Math.max(0, input.windowMs - input.oldestCallAgeMs);
  return { allowed: false, retryAfterMs };
}
