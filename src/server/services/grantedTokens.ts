import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { consumeToken, effectToRow, type ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import { deleteFeatureEffect, updateFeatureEffect } from "@/src/server/repos/activeEffects";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-163 (ADR 0101) — une activation accordée par un jeton vient d'être
 * jouée : le jeton perd un usage, et le dernier usage retire l'effet. Le
 * porteur est le personnage qui a joué (règle `can_edit_entity` : son
 * propre effet, MJ ou joueuse). Rien d'autre n'est touché.
 *
 * Coût (QUOTAS) : une écriture (mise à jour ou suppression d'une ligne).
 */
export async function consumeGrantedToken(
  supabase: TypedClient,
  effects: readonly ActiveDurableEffect[],
  params: { instanceId: string; bearer: string },
): Promise<void> {
  const r = consumeToken(effects, { instanceId: params.instanceId, by: params.bearer });
  if (!r.ok) throw new Error(`Jeton introuvable ou d'un autre porteur (${r.reason}).`);
  if (r.expired.length > 0) {
    await deleteFeatureEffect(supabase, params.instanceId);
    return;
  }
  const reste = r.kept.find((e) => e.instanceId === params.instanceId);
  if (!reste) return;
  const ligne = effectToRow(reste, reste.ruleKey ?? "");
  await updateFeatureEffect(supabase, params.instanceId, { payload: ligne.payload as unknown as Json });
}
