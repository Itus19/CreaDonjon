import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RuntimeStateRow {
  id: string;
  entity_id: string;
  campaign_id: string | null;
  state: Json;
  updated_at: string;
}

const RUNTIME_STATE_COLUMNS = "id, entity_id, campaign_id, state, updated_at";

/**
 * Une entite dans une campagne precise, ou hors partie si `campaignId` est
 * `null` (SCHEMA.md §12.1). L'index d'unicite de la table porte sur
 * `coalesce(campaign_id, '00000000-...')`, une expression : PostgREST ne
 * peut pas l'utiliser comme cible d'upsert (`on_conflict` exige des
 * colonnes litterales), d'ou la lecture explicite avant ecriture plutot
 * qu'un upsert direct.
 */
export async function getRuntimeState(
  supabase: TypedClient,
  entityId: string,
  campaignId: string | null
): Promise<RuntimeStateRow | null> {
  let query = supabase.from("entity_runtime_state").select(RUNTIME_STATE_COLUMNS).eq("entity_id", entityId);
  query = campaignId ? query.eq("campaign_id", campaignId) : query.is("campaign_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Cree ou remplace l'etat d'une entite pour une campagne (ou hors partie) donnee — voir `getRuntimeState` pour la raison de l'absence d'upsert direct. */
export async function putRuntimeState(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; state: Json }
): Promise<RuntimeStateRow> {
  const existing = await getRuntimeState(supabase, params.entityId, params.campaignId);

  if (existing) {
    const { data, error } = await supabase
      .from("entity_runtime_state")
      .update({ state: params.state, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select(RUNTIME_STATE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("entity_runtime_state")
    .insert({ entity_id: params.entityId, campaign_id: params.campaignId, state: params.state })
    .select(RUNTIME_STATE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
