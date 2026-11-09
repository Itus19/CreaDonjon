import { evaluate } from "../formula/evaluate";
import type { Rng } from "../dice/rng";
import type { Aura } from "../schemas/rule-blocks/primitives";
import { distance, type Point } from "./geometry";

/**
 * V3.1-168 (ADR 0077) — les auras reçues par une créature, en fonction PURE.
 * Une aura part d'une source posée sur le plan ; elle couvre ceux qui sont à
 * son rayon ou moins, selon son camp (`affects`), la source elle-même si
 * `self`, et seulement tant que la source ne porte aucun des états de
 * `unless_conditions` (Neutralisé). Ses formules se lisent avec les nombres
 * de la SOURCE (« + mod. CHA du paladin »), jamais de celui qui la reçoit.
 * Sans position (pas encore posé), rien ne s'étend.
 */

export interface AuraSource {
  id: string;
  pos: Point | null;
  team: string;
  conditions: readonly string[];
  numbers: Readonly<Record<string, number>>;
  label: string;
  auras: readonly Aura[];
}

export interface ReceivedAura {
  key: string;
  label: string;
  modifiers: { target: string; op: Aura["modifiers"][number]["op"]; value?: number }[];
}

/** Une aura ne lance jamais de dé : un `dice` dans sa formule est une faute de donnée. */
const SANS_DE: Rng = {
  nextInt() {
    throw new Error("une aura ne lance pas de dé");
  },
};

export function aurasCovering(p: { target: { id: string; pos: Point | null; team: string }; sources: readonly AuraSource[] }): ReceivedAura[] {
  const out: ReceivedAura[] = [];
  if (!p.target.pos) return out;
  for (const s of p.sources) {
    if (!s.pos) continue;
    s.auras.forEach((a, i) => {
      if ((a.unless_conditions ?? []).some((c) => s.conditions.includes(c))) return;
      const soi = s.id === p.target.id;
      if (soi ? !a.self : distance(s.pos!, p.target.pos!) > a.radius + 1e-9) return;
      if (!soi) {
        const allie = s.team === p.target.team;
        if ((a.affects === "allies" && !allie) || (a.affects === "enemies" && allie)) return;
      }
      out.push({
        key: `aura:${s.id}:${i}`,
        label: s.label,
        modifiers: a.modifiers.map((m) => ({
          target: m.target,
          op: m.op,
          ...(m.value === undefined ? {} : { value: typeof m.value === "number" ? m.value : evaluate(m.value, s.numbers, SANS_DE, "average").value }),
        })),
      });
    });
  }
  return out;
}
