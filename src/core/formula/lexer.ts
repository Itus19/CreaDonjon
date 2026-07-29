import { FormulaParseError } from "./errors";

export type Token =
  | { type: "number"; value: number }
  | { type: "dice"; count: number; faces: number; keep?: { mode: "kh" | "kl"; count: number } }
  | { type: "ref"; name: string }
  | { type: "ident"; name: string }
  | { type: "+" }
  | { type: "-" }
  | { type: "*" }
  | { type: "/" }
  | { type: "(" }
  | { type: ")" }
  | { type: "," }
  | { type: "eof" };

function isDigit(c: string | undefined): c is string {
  return c !== undefined && c >= "0" && c <= "9";
}

function isAlpha(c: string | undefined): c is string {
  return c !== undefined && /[a-zA-Z_]/.test(c);
}

function isAlphaNum(c: string | undefined): c is string {
  return c !== undefined && /[a-zA-Z_0-9]/.test(c);
}

/** Transforme une formule texte en jetons. Grammaire de surface : SCHEMA.md §20.1. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const n = input.length;
  let i = 0;

  while (i < n) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "(" || c === ")" || c === ",") {
      tokens.push({ type: c } as Token);
      i++;
      continue;
    }
    if (c === "{") {
      const end = input.indexOf("}", i);
      if (end === -1) {
        throw new FormulaParseError(`Accolade non fermee a la position ${i}`);
      }
      const name = input.slice(i + 1, end).trim();
      if (!name) {
        throw new FormulaParseError(`Reference vide a la position ${i}`);
      }
      tokens.push({ type: "ref", name });
      i = end + 1;
      continue;
    }
    if (isDigit(c)) {
      let j = i;
      while (isDigit(input[j])) j++;

      // Nombre decimal : jamais de notation de des sur un compte fractionnaire.
      if (input[j] === "." && isDigit(input[j + 1])) {
        let k = j + 1;
        while (isDigit(input[k])) k++;
        tokens.push({ type: "number", value: parseFloat(input.slice(i, k)) });
        i = k;
        continue;
      }

      const count = parseInt(input.slice(i, j), 10);

      if (input[j] === "d" && isDigit(input[j + 1])) {
        let k = j + 1;
        while (isDigit(input[k])) k++;
        const faces = parseInt(input.slice(j + 1, k), 10);

        let keep: { mode: "kh" | "kl"; count: number } | undefined;
        const suffix = input.slice(k, k + 2);
        if (suffix === "kh" || suffix === "kl") {
          const mode = suffix as "kh" | "kl";
          let m = k + 2;
          const start = m;
          while (isDigit(input[m])) m++;
          if (m === start) {
            throw new FormulaParseError(`Nombre attendu apres '${mode}' a la position ${k}`);
          }
          keep = { mode, count: parseInt(input.slice(start, m), 10) };
          k = m;
        }

        tokens.push({ type: "dice", count, faces, keep });
        i = k;
        continue;
      }

      tokens.push({ type: "number", value: count });
      i = j;
      continue;
    }
    if (isAlpha(c)) {
      let j = i;
      while (isAlphaNum(input[j])) j++;
      tokens.push({ type: "ident", name: input.slice(i, j) });
      i = j;
      continue;
    }

    throw new FormulaParseError(`Caractere inattendu '${c}' a la position ${i}`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}
