import { brickPaths, type ActivationBlockData, type RuleResourcesBlockData } from "../schemas/rule-blocks/playable";
import type { EffectNode } from "./triggers";
import { coverageState, type CoverageState } from "./activation";

export { brickPaths };

/**
 * V3.1-132 — le noyau de l'éditeur de briques. Pur : l'écran l'appelle pour
 * résumer la couverture d'une règle et pour nettoyer le bloc avant de
 * l'enregistrer ; le serveur revalide de toute façon par les schémas Zod.
 */

/** Les types de règles qui se « jouent » (une aptitude, un sort, un objet magique) : les autres (classe, règle générale…) n'ont pas d'état de couverture. */
export const COVERAGE_ENTRY_TYPES = ["feature", "spell", "magic_item"] as const;

export interface CoverageSummary {
  state: CoverageState;
  /** Les briques saisies : ressources, briques d'activation (`brickPaths`), effets qui durent. */
  bricks: number;
  /** Celles qui citent le passage du texte dont elles viennent. */
  cited: number;
  gaps: number;
}

/** Les blocs DÉJÀ validés d'une règle (type et données). Un bloc d'un autre type ne compte que pour l'état. */
export function coverageSummary(blocks: readonly { blockType: string; data: unknown }[]): CoverageSummary {
  let bricks = 0;
  let cited = 0;
  let gaps = 0;
  for (const b of blocks) {
    if (b.blockType === "resources") {
      const d = b.data as RuleResourcesBlockData;
      bricks += d.resources.length;
      cited += d.resources.filter((r) => r.passage).length;
    } else if (b.blockType === "activation") {
      const d = b.data as ActivationBlockData;
      for (const a of d.activations) {
        const chemins = brickPaths(a);
        bricks += chemins.length;
        cited += chemins.filter((c) => a.passages?.[c]).length;
      }
      bricks += d.durable_effects.length;
      cited += d.durable_effects.filter((e) => e.passage).length;
    } else if (b.blockType === "coverage") {
      gaps += (b.data as { gaps: readonly unknown[] }).gaps.length;
    }
  }
  return { state: coverageState({ blockTypes: blocks.map((b) => b.blockType), gaps: new Array(gaps) }), bricks, cited, gaps };
}

function posedIds(effects: readonly EffectNode[]): string[] {
  return effects.flatMap((e) => {
    if (e.action === "apply_effect") return [e.effect];
    if (e.action === "saving_throw") return [...posedIds(e.on_fail ?? []), ...posedIds(e.on_pass ?? [])];
    return [];
  });
}

/**
 * À l'écran, « Appliquer un état » est une seule brique (`apply_effect` + son
 * effet qui dure). Quand la brique part, l'effet qui dure part avec elle :
 * on retire ceux que plus aucune liste d'effets ne pose.
 */
export function pruneOrphanDurableEffects(data: ActivationBlockData): ActivationBlockData {
  const poses = new Set(data.activations.flatMap((a) => [a.effects, ...(a.variants ?? []).map((v) => v.effects)].flatMap(posedIds)));
  return { ...data, durable_effects: data.durable_effects.filter((e) => poses.has(e.id)) };
}

/**
 * Les blocs dont on garde la DONNÉE pour la couverture (V3.1-215) : `coverage`
 * (les lacunes déclarées), `species_traits` (les aptitudes d'une espèce),
 * `actions` et `traits` (un monstre). Les autres blocs ne comptent que par leur type.
 */
export const COVERAGE_DATA_BLOCK_TYPES = ["coverage", "species_traits", "actions", "traits"] as const;

const estDonneeDeCouverture = (t: string): boolean => (COVERAGE_DATA_BLOCK_TYPES as readonly string[]).includes(t);

/** Ce qu'il faut savoir d'une règle pour son état de couverture : ses types de blocs, et la donnée de ceux de `COVERAGE_DATA_BLOCK_TYPES`. */
export interface BlockFacts {
  types: Set<string>;
  data: Map<string, unknown>;
}

/** Une surcharge de la chaîne, dans l'ordre où `applyOverrides` l'appliquerait (racine vers feuille). */
export interface OverrideFact {
  entryKey: string;
  action: string;
  blockType: string | null;
  payload: unknown;
}

/**
 * V3.1-132, étendue en V3.1-215 — la vue « règles non jouables » d'un ruleset :
 * les mêmes actions que `applyOverrides`, réduites aux types de blocs et à la
 * donnée des quatre blocs utiles à la couverture, pour toutes les règles d'un coup.
 */
export function applyOverrideFacts(base: ReadonlyMap<string, BlockFacts>, overrides: readonly OverrideFact[]): Map<string, BlockFacts> {
  const out = new Map([...base].map(([k, v]) => [k, { types: new Set(v.types), data: new Map(v.data) }]));
  for (const o of overrides) {
    if (o.action === "disable_entry") {
      out.delete(o.entryKey);
      continue;
    }
    if (o.action === "replace_entry") {
      const blocks = (o.payload as { blocks?: { block_type?: unknown; data?: unknown }[] } | null)?.blocks ?? [];
      const types = new Set<string>();
      const data = new Map<string, unknown>();
      for (const b of blocks) {
        if (typeof b.block_type !== "string") continue;
        types.add(b.block_type);
        if (estDonneeDeCouverture(b.block_type)) data.set(b.block_type, b.data);
      }
      out.set(o.entryKey, { types, data });
      continue;
    }
    if (o.action === "add_entry") {
      if (!out.has(o.entryKey)) out.set(o.entryKey, { types: new Set(), data: new Map() });
      continue;
    }
    const f = out.get(o.entryKey);
    if (!f || !o.blockType) continue;
    if (o.action === "add_block" || o.action === "replace_block") {
      f.types.add(o.blockType);
      if (estDonneeDeCouverture(o.blockType)) f.data.set(o.blockType, (o.payload as { data?: unknown } | null)?.data);
    } else if (o.action === "remove_block") {
      f.types.delete(o.blockType);
      f.data.delete(o.blockType);
    }
  }
  return out;
}
