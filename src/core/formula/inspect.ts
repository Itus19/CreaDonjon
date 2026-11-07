import type { FormulaNode } from "./ast";

/**
 * V3.1-155 (ADR 0074) — lire la forme d'une formule sans l'évaluer : y a-t-il
 * un dé, et quels sont ses termes additifs. Sert à séparer, dans la valeur
 * d'un modificateur, le dé de bonus (lancé à chaque jet) du nombre (sur la fiche).
 */
export function containsDice(n: FormulaNode): boolean {
  switch (n.op) {
    case "dice":
      return true;
    case "num":
    case "ref":
      return false;
    default:
      return n.args.some(containsDice);
  }
}

/** Les termes d'une somme (`1d4 + 1` → [1d4, 1]) ; tout autre nœud est un terme unique. */
export function additiveTerms(n: FormulaNode): FormulaNode[] {
  return n.op === "add" ? [...additiveTerms(n.args[0]), ...additiveTerms(n.args[1])] : [n];
}
