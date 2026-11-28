import type { Ability, Skill } from "./abilities";

/**
 * V3.2-50 (ADR 0118 §5) — Ce qu'un jet réussi sur un PNJ fait découvrir.
 *
 * Le moteur choisit, jamais l'IA : la compétence dit quel genre de détail on
 * cherche, la marge (total moins DD) dit jusqu'où on va.
 *
 * - Perception : la carrure (Force) et ce qui est caché sur lui ; à 5 de
 *   marge, son armure (CA) et son aisance (Dextérité) ; à 10, ses façons de
 *   se battre (actions).
 * - Perspicacité : ce qu'il ressent et comment il se tient (Sagesse,
 *   Charisme) ; à 5, sa vivacité d'esprit (Intelligence).
 * - Investigation : sa bourse et ce qu'il cache ; à 5, son Intelligence.
 * - Médecine : sa santé (PV) et sa Constitution.
 * - Athlétisme : sa Force ; à 5, sa Constitution.
 * - Un jet de caractéristique : celle qu'on jauge (la Sagesse lit aussi le
 *   Charisme, comme la Perspicacité).
 *
 * Ce qui est déjà connu n'est jamais révélé deux fois ; un objet porté à la
 * vue de tous n'est pas un indice (il est découvert d'un coup d'œil).
 *
 * Retour de l'auteur (27 novembre) : un objet caché l'est avec un effort, un
 * DD secret propre à l'objet (`conceal_dc`, 15 par défaut). Réussir le DD
 * affiché ne suffit pas : il faut que le total l'atteigne aussi. Ainsi un
 * « rien trouvé » après un jet réussi ne dit pas qu'il n'y a rien.
 */

export type RevealCheck = { kind: "skill"; key: Skill } | { kind: "ability"; key: Ability };

/** Juste ce qu'il faut savoir du PNJ : combien d'actions et de traits, quels objets. */
export interface RevealNpc {
  sheet: { actions: number; traits: number } | null;
  gear: { items: readonly { id: string; equipped?: boolean; concealed?: boolean; conceal_dc?: number }[] } | null;
  /** V3.2-81 — ses signes distinctifs dissimulés (paragraphes de description), avec leur difficulté. */
  marks?: readonly { id: string; dc: number }[];
}

type Facet = "ability:str" | "ability:dex" | "ability:con" | "ability:int" | "ability:wis" | "ability:cha" | "ac" | "hp" | "purse" | "concealed" | "actions";

/** Par palier de marge : 0, 5, 10. */
const BY_SKILL: Partial<Record<Skill, readonly (readonly Facet[])[]>> = {
  perception: [["ability:str", "concealed"], ["ac", "ability:dex"], ["actions"]],
  insight: [["ability:wis", "ability:cha"], ["ability:int"]],
  investigation: [["purse", "concealed"], ["ability:int"]],
  medicine: [["hp", "ability:con"]],
  athletics: [["ability:str"], ["ability:con"]],
};

const BY_ABILITY: Record<Ability, readonly (readonly Facet[])[]> = {
  str: [["ability:str"]],
  dex: [["ability:dex"]],
  con: [["ability:con"]],
  int: [["ability:int"]],
  wis: [["ability:wis", "ability:cha"]],
  cha: [["ability:cha"]],
};

const TIERS = [0, 5, 10] as const;
/** L'effort par défaut pour cacher un objet, quand le tirage n'en a pas fixé. */
export const DEFAULT_CONCEAL_DC = 15;

export function facetsRevealedByCheck(params: { check: RevealCheck; total: number; dc: number; npc: RevealNpc; known: ReadonlySet<string> }): string[] {
  const margin = params.total - params.dc;
  if (margin < 0) return [];
  const table = params.check.kind === "skill" ? BY_SKILL[params.check.key] : BY_ABILITY[params.check.key];
  if (!table) return [];
  const facets = table.filter((_, i) => margin >= TIERS[i]!).flat();

  const keys = facets.flatMap((facet): string[] => {
    const { sheet, gear } = params.npc;
    if (facet === "concealed") {
      const objets = gear ? gear.items.filter((i) => i.concealed === true && params.total >= (i.conceal_dc ?? DEFAULT_CONCEAL_DC)).map((i) => `item:${i.id}`) : [];
      const signes = (params.npc.marks ?? []).filter((m) => params.total >= m.dc).map((m) => `mark:${m.id}`);
      return [...objets, ...signes];
    }
    if (facet === "purse") return gear ? ["purse"] : [];
    if (facet === "actions") return sheet ? Array.from({ length: sheet.actions }, (_, i) => `action:${i}`) : [];
    return sheet ? [facet] : [];
  });
  return [...new Set(keys)].filter((k) => !params.known.has(k));
}
