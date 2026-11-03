import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-130 (ADR 0060 §3, ADR 0073) — les effets qui durent, en base. Un
 * porteur par ligne : une fiche (`entity_id`, un PJ) ou une instance de combat
 * (`combat_participant_id`). Les droits sont ceux de la RLS : `can_edit_entity`
 * pour une fiche, administrateur du monde pour une instance ; un joueur qui
 * pose un effet sur ce qu'il ne peut pas écrire passe par le changement signé.
 */

export const ACTIVE_EFFECT_COLUMNS = "id, entity_id, combat_participant_id, campaign_id, source_kind, source_key, label, modifiers, duration, payload, created_at";

export interface ActiveEffectRow {
  id: string;
  entity_id: string | null;
  combat_participant_id: string | null;
  campaign_id: string;
  source_kind: string;
  source_key: string | null;
  label: string;
  modifiers: Json;
  duration: Json;
  payload: Json;
  created_at: string;
}

/** Les effets posés par une règle sur une fiche, dans une campagne. */
export async function listFeatureEffectsForEntity(supabase: TypedClient, entityId: string, campaignId: string): Promise<ActiveEffectRow[]> {
  const { data, error } = await supabase
    .from("entity_active_effects")
    .select(ACTIVE_EFFECT_COLUMNS)
    .eq("entity_id", entityId)
    .eq("campaign_id", campaignId)
    .eq("source_kind", "feature")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

/** Les effets d'une campagne posés par une règle sur des fiches OU des instances (une seule requête, pour la bascule de tour). */
export async function listFeatureEffectsForBearers(
  supabase: TypedClient,
  params: { campaignId: string; entityIds: readonly string[]; participantIds: readonly string[] }
): Promise<ActiveEffectRow[]> {
  const filtres = [
    ...(params.entityIds.length > 0 ? [`entity_id.in.(${params.entityIds.join(",")})`] : []),
    ...(params.participantIds.length > 0 ? [`combat_participant_id.in.(${params.participantIds.join(",")})`] : []),
  ];
  if (filtres.length === 0) return [];
  const { data, error } = await supabase
    .from("entity_active_effects")
    .select(ACTIVE_EFFECT_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .eq("source_kind", "feature")
    .or(filtres.join(","))
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

export interface NewFeatureEffect {
  campaignId: string;
  bearer: { entityId: string } | { participantId: string };
  label: string;
  sourceKey: string;
  modifiers: Json;
  duration: Json;
  payload: Json;
}

export async function insertFeatureEffect(supabase: TypedClient, e: NewFeatureEffect): Promise<ActiveEffectRow> {
  const { data, error } = await supabase
    .from("entity_active_effects")
    .insert({
      campaign_id: e.campaignId,
      ...("entityId" in e.bearer ? { entity_id: e.bearer.entityId } : { combat_participant_id: e.bearer.participantId }),
      source_kind: "feature",
      source_key: e.sourceKey,
      label: e.label,
      modifiers: e.modifiers,
      duration: e.duration,
      payload: e.payload,
    })
    .select(ACTIVE_EFFECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFeatureEffect(supabase: TypedClient, id: string, patch: { duration?: Json; payload?: Json }): Promise<void> {
  const { error } = await supabase.from("entity_active_effects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFeatureEffect(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("entity_active_effects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
