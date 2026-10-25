import { describe, expect, it } from "vitest";
import { decideRateLimit } from "./rateLimit";

describe("decideRateLimit", () => {
  it("autorise sous la limite", () => {
    const decision = decideRateLimit({ countInWindow: 5, limit: 30, windowMs: 3_600_000 });
    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterMs).toBeUndefined();
  });

  it("bloque a la limite atteinte", () => {
    const decision = decideRateLimit({ countInWindow: 30, limit: 30, windowMs: 3_600_000 });
    expect(decision.allowed).toBe(false);
  });

  it("bloque au-dela de la limite", () => {
    const decision = decideRateLimit({ countInWindow: 31, limit: 30, windowMs: 3_600_000 });
    expect(decision.allowed).toBe(false);
  });

  it("sans age du plus ancien appel, conseille d'attendre la fenetre entiere", () => {
    const decision = decideRateLimit({ countInWindow: 30, limit: 30, windowMs: 3_600_000 });
    expect(decision.retryAfterMs).toBe(3_600_000);
  });

  it("avec l'age du plus ancien appel, ne conseille d'attendre que le reste de la fenetre", () => {
    const decision = decideRateLimit({ countInWindow: 30, limit: 30, windowMs: 3_600_000, oldestCallAgeMs: 1_000_000 });
    expect(decision.retryAfterMs).toBe(2_600_000);
  });

  it("ne renvoie jamais un delai negatif si le plus ancien appel a deja depasse la fenetre", () => {
    const decision = decideRateLimit({ countInWindow: 30, limit: 30, windowMs: 3_600_000, oldestCallAgeMs: 4_000_000 });
    expect(decision.retryAfterMs).toBe(0);
  });
  /** V3.1-65 : l'encart d'assistance IA montre « ce qu'il reste » — le compte vient d'ici, jamais d'un calcul refait dans l'interface. */
  it("rend le nombre d'appels restants", () => {
    expect(decideRateLimit({ countInWindow: 5, limit: 30, windowMs: 3_600_000 }).remaining).toBe(25);
  });

  it("ne rend jamais un reste negatif", () => {
    expect(decideRateLimit({ countInWindow: 42, limit: 30, windowMs: 3_600_000 }).remaining).toBe(0);
  });
});
