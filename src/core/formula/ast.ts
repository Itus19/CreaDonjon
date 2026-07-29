export interface DiceKeepSpec {
  mode: "kh" | "kl";
  count: number;
}

/**
 * Arbre syntaxique d'une formule. Parse une fois a la saisie, jamais
 * re-parse a chaque evaluation (SCHEMA.md §20.2).
 */
export type FormulaNode =
  | { op: "num"; value: number }
  | { op: "dice"; count: number; faces: number; keep?: DiceKeepSpec }
  | { op: "ref"; name: string }
  | { op: "add"; args: [FormulaNode, FormulaNode] }
  | { op: "sub"; args: [FormulaNode, FormulaNode] }
  | { op: "mul"; args: [FormulaNode, FormulaNode] }
  | { op: "div"; args: [FormulaNode, FormulaNode] }
  | { op: "min"; args: FormulaNode[] }
  | { op: "max"; args: FormulaNode[] }
  | { op: "floor"; args: [FormulaNode] }
  | { op: "ceil"; args: [FormulaNode] }
  | { op: "round"; args: [FormulaNode] };
