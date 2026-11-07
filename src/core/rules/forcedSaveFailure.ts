import type { ForcedSaveFailuresBlockData } from "../schemas/rule-blocks/blocks";
import { zStoredEffectPayload } from "./durableEffects";

/**
 * V3.1-186 — une sauvegarde qui échoue d'office : « une créature Charmée par
 * vous rate automatiquement son jet de sauvegarde contre toute injonction que
 * vous lancez » (Mante de majesté). Pur. Les états de la cible viennent avec
 * leur source (l'effet actif qui les pose, ADR 0073) ; une source inconnue ne
 * suffit pas quand la règle exige qu'elle soit la lanceuse.
 */
export interface SaveAgainstSpell {
  spellKey: string;
  casterId: string;
  targetConditions: readonly { key: string; sourceId: string | null }[];
}

export function saveAutomaticallyFails(rules: ForcedSaveFailuresBlockData["failures"], save: SaveAgainstSpell): boolean {
  return rules.some(
    (r) =>
      r.spells.includes(save.spellKey) &&
      save.targetConditions.some((c) => c.key === r.target_condition && (!r.imposed_by_caster || c.sourceId === save.casterId))
  );
}

/**
 * Les états d'une cible, chacun avec la source de l'effet qui le pose
 * (`payload.source` d'un effet de règle, ADR 0073). Un état sans effet qui le
 * porte (posé à la main) a une source inconnue. Un effet mal formé ne donne
 * aucune source, sans faire tomber la lecture.
 */
export function conditionsWithSource(
  conditions: readonly string[],
  effects: readonly { payload: unknown }[]
): { key: string; sourceId: string | null }[] {
  const sources = new Map<string, string>();
  for (const e of effects) {
    const p = zStoredEffectPayload.safeParse(e.payload);
    if (!p.success) continue;
    for (const c of p.data.conditions) if (!sources.has(c)) sources.set(c, p.data.source);
  }
  return conditions.map((key) => ({ key, sourceId: sources.get(key) ?? null }));
}
