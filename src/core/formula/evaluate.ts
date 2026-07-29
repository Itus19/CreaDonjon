import type { Rng } from "../dice/rng";
import { averageDiceValue, extremeDice, rollDice } from "../dice/roll";
import type { FormulaNode } from "./ast";
import { UnknownReferenceError } from "./errors";

export type EvalMode = "roll" | "average" | "min" | "max";

export interface TraceStep {
  text: string;
  value: number;
}

export interface EvalResult {
  value: number;
  trace: TraceStep[];
}

/** Contrat d'evaluation : SCHEMA.md §20.3. Le RNG est injecte, jamais Math.random(). */
export function evaluate(
  ast: FormulaNode,
  ctx: Readonly<Record<string, number>>,
  rng: Rng,
  mode: EvalMode,
): EvalResult {
  return evalNode(ast, ctx, rng, mode);
}

function diceLabel(count: number, faces: number, keep?: { mode: "kh" | "kl"; count: number }): string {
  return `${count}d${faces}${keep ? keep.mode + keep.count : ""}`;
}

function evalNode(
  node: FormulaNode,
  ctx: Readonly<Record<string, number>>,
  rng: Rng,
  mode: EvalMode,
): EvalResult {
  switch (node.op) {
    case "num":
      return { value: node.value, trace: [] };

    case "ref": {
      if (!(node.name in ctx)) {
        throw new UnknownReferenceError(node.name);
      }
      const value = ctx[node.name];
      return { value, trace: [{ text: `{${node.name}} = ${value}`, value }] };
    }

    case "dice": {
      const label = diceLabel(node.count, node.faces, node.keep);

      if (mode === "average") {
        const value = averageDiceValue(node.count, node.faces, node.keep);
        return { value, trace: [{ text: `${label} (moyenne) = ${value}`, value }] };
      }

      const result =
        mode === "min" || mode === "max"
          ? extremeDice(node.count, node.faces, mode, node.keep)
          : rollDice(node.count, node.faces, rng, node.keep);

      return {
        value: result.total,
        trace: [{ text: `${label} (${result.rolls.join(", ")}) = ${result.total}`, value: result.total }],
      };
    }

    case "add": {
      const l = evalNode(node.args[0], ctx, rng, mode);
      const r = evalNode(node.args[1], ctx, rng, mode);
      const value = l.value + r.value;
      return { value, trace: [...l.trace, ...r.trace, { text: `${l.value} + ${r.value} = ${value}`, value }] };
    }
    case "sub": {
      const l = evalNode(node.args[0], ctx, rng, mode);
      const r = evalNode(node.args[1], ctx, rng, mode);
      const value = l.value - r.value;
      return { value, trace: [...l.trace, ...r.trace, { text: `${l.value} - ${r.value} = ${value}`, value }] };
    }
    case "mul": {
      const l = evalNode(node.args[0], ctx, rng, mode);
      const r = evalNode(node.args[1], ctx, rng, mode);
      const value = l.value * r.value;
      return { value, trace: [...l.trace, ...r.trace, { text: `${l.value} * ${r.value} = ${value}`, value }] };
    }
    case "div": {
      const l = evalNode(node.args[0], ctx, rng, mode);
      const r = evalNode(node.args[1], ctx, rng, mode);
      if (r.value === 0) {
        throw new RangeError("Division par zero dans une formule");
      }
      const value = l.value / r.value;
      return { value, trace: [...l.trace, ...r.trace, { text: `${l.value} / ${r.value} = ${value}`, value }] };
    }

    case "min": {
      const results = node.args.map((arg) => evalNode(arg, ctx, rng, mode));
      const value = Math.min(...results.map((r) => r.value));
      const trace = results.flatMap((r) => r.trace);
      trace.push({ text: `min(${results.map((r) => r.value).join(", ")}) = ${value}`, value });
      return { value, trace };
    }
    case "max": {
      const results = node.args.map((arg) => evalNode(arg, ctx, rng, mode));
      const value = Math.max(...results.map((r) => r.value));
      const trace = results.flatMap((r) => r.trace);
      trace.push({ text: `max(${results.map((r) => r.value).join(", ")}) = ${value}`, value });
      return { value, trace };
    }
    case "floor": {
      const a = evalNode(node.args[0], ctx, rng, mode);
      const value = Math.floor(a.value);
      return { value, trace: [...a.trace, { text: `floor(${a.value}) = ${value}`, value }] };
    }
    case "ceil": {
      const a = evalNode(node.args[0], ctx, rng, mode);
      const value = Math.ceil(a.value);
      return { value, trace: [...a.trace, { text: `ceil(${a.value}) = ${value}`, value }] };
    }
    case "round": {
      const a = evalNode(node.args[0], ctx, rng, mode);
      const value = Math.round(a.value);
      return { value, trace: [...a.trace, { text: `round(${a.value}) = ${value}`, value }] };
    }
  }
}

/** Concatene une trace en une chaine lisible pour l'affichage. */
export function formatTrace(trace: TraceStep[]): string {
  return trace.map((s) => s.text).join(" ; ");
}
