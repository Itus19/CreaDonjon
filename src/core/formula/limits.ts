/** Limites de securite du moteur de formules (SCHEMA.md §20.4). */
export const FORMULA_LIMITS = {
  /** Nombre maximal de des dans un seul noeud `dice` (ex: `1000d6`). */
  maxDiceCount: 1000,
  /** Nombre maximal de faces d'un de. */
  maxDiceFaces: 1_000_000,
  /** Profondeur maximale de l'arbre syntaxique (parentheses/fonctions imbriquees). */
  maxAstDepth: 32,
  /** Nombre maximal de noeuds au total dans l'arbre. */
  maxNodeCount: 500,
} as const;
