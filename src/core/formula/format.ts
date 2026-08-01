import type { FormulaNode } from "./ast";

/**
 * Formate un AST en la meme syntaxe que celle acceptee par parseFormula
 * (SCHEMA.md §20) — utilise pour l'affichage des blocs de regles
 * (specs/regles-blocs.md §5-7) : un effet ou une colonne de progression
 * montre "8d6" ou "2d6+{STR_MOD}", jamais l'AST brut.
 *
 * Round-trip garanti : formatFormulaNode(ast) reparse vers le meme AST.
 * Les operandes de meme priorite qu'un parent non commutatif (sub, div) ou
 * situes a droite sont toujours parenthesees, pour ne jamais laisser le
 * re-parsing associatif a gauche regrouper autrement que l'original.
 */
export function formatFormulaNode(node: FormulaNode): string {
  return formatNode(node);
}

function precedence(node: FormulaNode): number {
  switch (node.op) {
    case "add":
    case "sub":
      return 1;
    case "mul":
    case "div":
      return 2;
    default:
      return 3;
  }
}

function formatNode(node: FormulaNode): string {
  switch (node.op) {
    case "num":
      return String(node.value);
    case "ref":
      return `{${node.name}}`;
    case "dice":
      return `${node.count}d${node.faces}${node.keep ? `${node.keep.mode}${node.keep.count}` : ""}`;
    case "add":
      return formatBinary(node, "+");
    case "sub":
      return formatBinary(node, "-");
    case "mul":
      return formatBinary(node, "*");
    case "div":
      return formatBinary(node, "/");
    case "min":
      return `min(${node.args.map(formatNode).join(", ")})`;
    case "max":
      return `max(${node.args.map(formatNode).join(", ")})`;
    case "floor":
      return `floor(${formatNode(node.args[0])})`;
    case "ceil":
      return `ceil(${formatNode(node.args[0])})`;
    case "round":
      return `round(${formatNode(node.args[0])})`;
  }
}

function formatBinary(node: { op: string; args: [FormulaNode, FormulaNode] }, symbol: string): string {
  const parentPrecedence = precedence(node as FormulaNode);
  const [left, right] = node.args;

  const leftText = precedence(left) < parentPrecedence ? `(${formatNode(left)})` : formatNode(left);
  const rightText = precedence(right) <= parentPrecedence ? `(${formatNode(right)})` : formatNode(right);

  return `${leftText} ${symbol} ${rightText}`;
}
