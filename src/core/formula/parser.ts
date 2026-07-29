import type { FormulaNode } from "./ast";
import { FormulaLimitError, FormulaParseError } from "./errors";
import { tokenize, type Token } from "./lexer";
import { FORMULA_LIMITS } from "./limits";

const FUNCTION_NAMES = new Set(["min", "max", "floor", "ceil", "round"]);

class Parser {
  private pos = 0;
  private nodeCount = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FormulaNode {
    const node = this.parseFormula(0);
    this.expect("eof");
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token["type"]): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new FormulaParseError(`Attendu '${type}', trouve ${JSON.stringify(t)}`);
    }
    return this.advance();
  }

  private checkDepth(depth: number) {
    if (depth > FORMULA_LIMITS.maxAstDepth) {
      throw new FormulaLimitError(
        `Profondeur maximale de l'expression depassee (${FORMULA_LIMITS.maxAstDepth})`,
      );
    }
  }

  private countNode() {
    this.nodeCount++;
    if (this.nodeCount > FORMULA_LIMITS.maxNodeCount) {
      throw new FormulaLimitError(`Nombre maximal de noeuds depasse (${FORMULA_LIMITS.maxNodeCount})`);
    }
  }

  // formule ::= terme (('+' | '-') terme)*
  private parseFormula(depth: number): FormulaNode {
    this.checkDepth(depth);
    let node = this.parseTerm(depth);
    for (;;) {
      const t = this.peek();
      if (t.type === "+" || t.type === "-") {
        this.advance();
        const right = this.parseTerm(depth);
        this.countNode();
        node = { op: t.type === "+" ? "add" : "sub", args: [node, right] };
      } else {
        break;
      }
    }
    return node;
  }

  // terme ::= facteur (('*' | '/') facteur)*
  private parseTerm(depth: number): FormulaNode {
    let node = this.parseFactor(depth);
    for (;;) {
      const t = this.peek();
      if (t.type === "*" || t.type === "/") {
        this.advance();
        const right = this.parseFactor(depth);
        this.countNode();
        node = { op: t.type === "*" ? "mul" : "div", args: [node, right] };
      } else {
        break;
      }
    }
    return node;
  }

  // facteur ::= nombre | de | reference | fonction | '(' formule ')'
  private parseFactor(depth: number): FormulaNode {
    const t = this.peek();

    if (t.type === "number") {
      this.advance();
      this.countNode();
      return { op: "num", value: t.value };
    }

    if (t.type === "dice") {
      this.advance();
      if (t.count <= 0 || t.count > FORMULA_LIMITS.maxDiceCount) {
        throw new FormulaLimitError(
          `Nombre de des invalide ou trop eleve (max ${FORMULA_LIMITS.maxDiceCount})`,
        );
      }
      if (t.faces <= 0 || t.faces > FORMULA_LIMITS.maxDiceFaces) {
        throw new FormulaLimitError(
          `Nombre de faces invalide ou trop eleve (max ${FORMULA_LIMITS.maxDiceFaces})`,
        );
      }
      if (t.keep && (t.keep.count <= 0 || t.keep.count > t.count)) {
        throw new FormulaParseError(
          `Le nombre de des a garder (${t.keep.count}) doit etre compris entre 1 et ${t.count}`,
        );
      }
      this.countNode();
      return { op: "dice", count: t.count, faces: t.faces, keep: t.keep };
    }

    if (t.type === "ref") {
      this.advance();
      this.countNode();
      return { op: "ref", name: t.name };
    }

    if (t.type === "(") {
      this.advance();
      const inner = this.parseFormula(depth + 1);
      this.expect(")");
      return inner;
    }

    if (t.type === "ident") {
      if (!FUNCTION_NAMES.has(t.name)) {
        throw new FormulaParseError(`Fonction inconnue : '${t.name}'`);
      }
      const fname = t.name;
      this.advance();
      this.expect("(");
      const args: FormulaNode[] = [this.parseFormula(depth + 1)];
      while (this.peek().type === ",") {
        this.advance();
        args.push(this.parseFormula(depth + 1));
      }
      this.expect(")");
      this.countNode();

      if ((fname === "floor" || fname === "ceil" || fname === "round") && args.length !== 1) {
        throw new FormulaParseError(`'${fname}()' attend exactement un argument`);
      }

      if (fname === "floor") return { op: "floor", args: [args[0]] };
      if (fname === "ceil") return { op: "ceil", args: [args[0]] };
      if (fname === "round") return { op: "round", args: [args[0]] };
      return { op: fname as "min" | "max", args };
    }

    throw new FormulaParseError(`Jeton inattendu : ${JSON.stringify(t)}`);
  }
}

/** Parse une formule texte en arbre syntaxique. Ne l'evalue pas. */
export function parseFormula(input: string): FormulaNode {
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}
