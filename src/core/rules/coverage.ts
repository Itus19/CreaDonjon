import { COVERAGE_BRICKS, type CoverageBrick } from "../schemas/rule-blocks/playable";
import { MECHANICAL_BLOCK_TYPES } from "./activation";

/**
 * V3.1-212 (ADR 0100) — ce que « jouable » veut dire, par catégorie de fiche.
 * Fonction pure : la vue du MJ et le rapport de couverture la partagent.
 * Calculé, jamais stocké (règle 16).
 */
export { COVERAGE_BRICKS, type CoverageBrick };

export type CoverageCategory =
  | "feature"
  | "spell"
  | "magic_item"
  | "weapon"
  | "armor"
  | "class"
  | "species"
  | "subclass"
  | "monster"
  | "condition"
  | "out_of_scope";

export type CoverageStateOf = "playable" | "partial" | "unevaluated" | "out_of_scope";

export interface CoverageGapOf {
  brick: CoverageBrick;
  /** Le passage de la règle (une lacune déclarée) ou le nom de l'action, du trait. */
  text: string;
  /** La règle d'où vient la lacune, quand elle est remontée d'une aptitude (espèce, sous-classe). */
  rule?: string;
}

export interface CoverageResult {
  state: CoverageStateOf;
  gaps: CoverageGapOf[];
}

/** Une lacune telle qu'elle vient du bloc `coverage` (la brique peut manquer, ou venir d'une donnée ancienne). */
export interface RawGap {
  text: string;
  missing: string;
  brick?: string;
}

export type CoverageFacts =
  | { category: "feature" | "spell" | "magic_item" | "weapon" | "armor" | "class"; blockTypes: readonly string[]; gaps: readonly RawGap[] }
  | { category: "species" | "subclass"; parts: readonly CoverageResult[] }
  | { category: "monster"; actions: readonly { name: string; attack: boolean; damage: boolean }[]; traits: readonly { name: string }[] }
  | { category: "condition"; key: string }
  | { category: "out_of_scope" };

/**
 * Les états que le moteur joue en entier : Aveuglé et Invisible changent
 * l'avantage d'une attaque (perception, ADR 0078). Les autres sont affichés,
 * ou joués en partie seulement (À terre par les bottes, Inconscient par les
 * jets contre la mort) : ils restent non évalués jusqu'à leur ticket.
 */
export const ENGINE_CONDITIONS: readonly string[] = ["blinded", "invisible"];

const PAR_TYPE: Record<string, CoverageCategory> = {
  feature: "feature",
  feat: "feature",
  spell: "spell",
  magic_item: "magic_item",
  weapon: "weapon",
  armor: "armor",
  class: "class",
  species: "species",
  subclass: "subclass",
  monster: "monster",
  condition: "condition",
};

/** Le type d'une fiche (`entry_type`) → sa catégorie ; historique, monture, règle générale, équipement : hors du compte. */
export function coverageCategoryOf(entryType: string): CoverageCategory {
  return PAR_TYPE[entryType] ?? "out_of_scope";
}

const brique = (b: string | undefined): CoverageBrick => ((COVERAGE_BRICKS as readonly string[]).includes(b ?? "") ? (b as CoverageBrick) : "other");

export function coverageOf(f: CoverageFacts): CoverageResult {
  switch (f.category) {
    case "out_of_scope":
      return { state: "out_of_scope", gaps: [] };
    case "condition":
      return { state: ENGINE_CONDITIONS.includes(f.key) ? "playable" : "unevaluated", gaps: [] };
    case "monster": {
      const gaps: CoverageGapOf[] = [
        ...f.actions.filter((a) => !a.attack && !a.damage).map((a) => ({ brick: "monster_action" as const, text: a.name })),
        ...f.traits.map((t) => ({ brick: "monster_trait" as const, text: t.name })),
      ];
      return { state: gaps.length > 0 ? "partial" : "playable", gaps };
    }
    case "species":
    case "subclass": {
      if (f.parts.length === 0 || f.parts.every((p) => p.state === "unevaluated")) return { state: "unevaluated", gaps: [] };
      const gaps = f.parts.flatMap((p) => p.gaps);
      return { state: f.parts.every((p) => p.state === "playable") ? "playable" : "partial", gaps };
    }
    default: {
      const gaps = f.gaps.map((g) => ({ brick: brique(g.brick), text: g.text }));
      if (gaps.length > 0) return { state: "partial", gaps };
      return { state: f.blockTypes.some((t) => (MECHANICAL_BLOCK_TYPES as readonly string[]).includes(t)) ? "playable" : "unevaluated", gaps };
    }
  }
}

export interface CoverageTally {
  playable: number;
  partial: number;
  unevaluated: number;
  /** Les fiches comptées (hors `out_of_scope`). */
  total: number;
  byBrick: Partial<Record<CoverageBrick, number>>;
}

/** Le compte d'un lot de résultats : par état, et les lacunes par brique. */
export function coverageTally(results: readonly CoverageResult[]): CoverageTally {
  const t: CoverageTally = { playable: 0, partial: 0, unevaluated: 0, total: 0, byBrick: {} };
  for (const r of results) {
    if (r.state === "out_of_scope") continue;
    t[r.state] += 1;
    t.total += 1;
    for (const g of r.gaps) t.byBrick[g.brick] = (t.byBrick[g.brick] ?? 0) + 1;
  }
  return t;
}
