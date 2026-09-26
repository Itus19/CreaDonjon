/**
 * V3-C4 — Le wiki qui se découvre.
 *
 * `mentioned` (on en a entendu parler) → `known` (rencontrée) → `detailed`
 * (fréquentée, fouillée) : un ordre total, jamais une régression — une
 * fiche déjà `detailed` ne redescend pas à `known` parce qu'une scène
 * postérieure ne la mentionne qu'en passant. Module PUR : la question « qui
 * a le droit d'écrire quel niveau » vit dans le service qui l'appelle
 * (`src/server/services/discoveries.ts`), jamais ici.
 */

export const DETAIL_LEVELS = ["mentioned", "known", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

const RANK: Record<DetailLevel, number> = { mentioned: 0, known: 1, detailed: 2 };

/** Le plus avancé des deux niveaux — `current` étant `null` quand rien n'a encore été découvert. */
export function promoteDetailLevel(current: DetailLevel | null, proposed: DetailLevel): DetailLevel {
  if (current === null) return proposed;
  return RANK[proposed] > RANK[current] ? proposed : current;
}
