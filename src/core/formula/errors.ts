/** Base commune des erreurs du moteur de formules. */
export class FormulaError extends Error {}

/** Erreur de syntaxe ou de forme, levee pendant le parsing. */
export class FormulaParseError extends FormulaError {
  constructor(message: string) {
    super(message);
    this.name = "FormulaParseError";
  }
}

/** Une des limites de securite de §20.4 (SCHEMA.md) a ete depassee. */
export class FormulaLimitError extends FormulaError {
  constructor(message: string) {
    super(message);
    this.name = "FormulaLimitError";
  }
}

/**
 * Une reference `{nom}` ne se trouve pas dans le contexte fourni a
 * l'evaluation. Ne retourne jamais 0 en silence : c'est le bug le plus
 * insidieux d'un moteur de regles (SCHEMA.md §20.4).
 */
export class UnknownReferenceError extends FormulaError {
  constructor(public readonly refName: string) {
    super(`Reference inconnue : {${refName}}`);
    this.name = "UnknownReferenceError";
  }
}
