import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface PersonalityEventRow {
  id: string;
  entity_id: string;
  summary: string;
  deltas: Json;
  origin: string;
  session_event_id: string | null;
  occurred_at_ingame: Json | null;
  created_at: string;
  /** Affichage au wiki public (V2, retour utilisateur point 5) — bascule binaire par ligne, masquee par defaut. */
  is_public: boolean;
}

const PERSONALITY_EVENT_COLUMNS =
  "id, entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at, is_public";

/** Journal en ajout seul (docs/adr/0013-tables-psyche-pnj.md) — jamais de mise a jour ni de suppression ici. */
export async function insertPersonalityEvent(
  supabase: TypedClient,
  params: {
    entityId: string;
    summary: string;
    deltas: Json;
    origin: string;
    sessionEventId: string | null;
    occurredAtIngame: Json | null;
  }
): Promise<PersonalityEventRow> {
  const { data, error } = await supabase
    .from("personality_events")
    .insert({
      entity_id: params.entityId,
      summary: params.summary,
      deltas: params.deltas,
      origin: params.origin,
      session_event_id: params.sessionEventId,
      occurred_at_ingame: params.occurredAtIngame,
    })
    .select(PERSONALITY_EVENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Les 20 dernieres d'abord (specs/psyche-pnj.md §4 : « l'ecran recoit les 20 dernieres entrees, le reste replie »). */
export async function listPersonalityEvents(
  supabase: TypedClient,
  entityId: string,
  limit = 20
): Promise<PersonalityEventRow[]> {
  const { data, error } = await supabase
    .from("personality_events")
    .select(PERSONALITY_EVENT_COLUMNS)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

/** Bascule "afficher au wiki" d'un souvenir (V2, retour utilisateur point 5) — pas de verification de version, meme discipline que `updateRelationVisibility` (src/server/repos/relations.ts) : un champ independant, pas de conflit possible avec une autre ecriture. */
export async function updatePersonalityEventVisibility(
  supabase: TypedClient,
  id: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await supabase.from("personality_events").update({ is_public: isPublic }).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface EntityAttitudeRow {
  id: string;
  campaign_id: string;
  source_entity_id: string;
  target_entity_id: string;
  axes: Json;
  updated_at: string;
}

/** `null` si aucun evenement n'a encore ete journalise pour cette paire dans cette campagne — pas une ligne a zero, une absence. */
export async function getAttitude(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string }
): Promise<EntityAttitudeRow | null> {
  const { data, error } = await supabase
    .from("entity_attitudes")
    .select("id, campaign_id, source_entity_id, target_entity_id, axes, updated_at")
    .eq("campaign_id", params.campaignId)
    .eq("source_entity_id", params.sourceEntityId)
    .eq("target_entity_id", params.targetEntityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Cache reconstructible (docs/adr/0013-tables-psyche-pnj.md) : upsert sur (campaign_id, source_entity_id, target_entity_id), jamais un insert qui dupliquerait la paire. */
export async function upsertAttitude(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string; axes: Json }
): Promise<EntityAttitudeRow> {
  const { data, error } = await supabase
    .from("entity_attitudes")
    .upsert(
      {
        campaign_id: params.campaignId,
        source_entity_id: params.sourceEntityId,
        target_entity_id: params.targetEntityId,
        axes: params.axes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id,source_entity_id,target_entity_id" }
    )
    .select("id, campaign_id, source_entity_id, target_entity_id, axes, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface AttitudeEventRow {
  id: string;
  campaign_id: string;
  source_entity_id: string;
  target_entity_id: string;
  summary: string;
  deltas: Json;
  origin: string;
  session_event_id: string | null;
  occurred_at_ingame: Json | null;
  created_at: string;
  /** Affichage au wiki public (V2, retour utilisateur point 5) — bascule binaire par ligne, masquee par defaut. */
  is_public: boolean;
}

const ATTITUDE_EVENT_COLUMNS =
  "id, campaign_id, source_entity_id, target_entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at, is_public";

/** Journal en ajout seul, par paire (specs/psyche-pnj.md §4). */
export async function insertAttitudeEvent(
  supabase: TypedClient,
  params: {
    campaignId: string;
    sourceEntityId: string;
    targetEntityId: string;
    summary: string;
    deltas: Json;
    origin: string;
    sessionEventId: string | null;
    occurredAtIngame: Json | null;
  }
): Promise<AttitudeEventRow> {
  const { data, error } = await supabase
    .from("attitude_events")
    .insert({
      campaign_id: params.campaignId,
      source_entity_id: params.sourceEntityId,
      target_entity_id: params.targetEntityId,
      summary: params.summary,
      deltas: params.deltas,
      origin: params.origin,
      session_event_id: params.sessionEventId,
      occurred_at_ingame: params.occurredAtIngame,
    })
    .select(ATTITUDE_EVENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Les 20 dernieres de CETTE paire (specs/psyche-pnj.md §4 — jamais un historique global). */
export async function listAttitudeEvents(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string },
  limit = 20
): Promise<AttitudeEventRow[]> {
  const { data, error } = await supabase
    .from("attitude_events")
    .select(ATTITUDE_EVENT_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .eq("source_entity_id", params.sourceEntityId)
    .eq("target_entity_id", params.targetEntityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * V3.1-71 — combien de souvenirs a cette paire, et le plus récent : compté
 * à la lecture (`count: "exact"`), jamais stocké (règle 16).
 */
export async function countAttitudeEvents(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string }
): Promise<{ count: number; last: { occurred_at_ingame: AttitudeEventRow["occurred_at_ingame"]; created_at: string } | null }> {
  const { data, error, count } = await supabase
    .from("attitude_events")
    .select("occurred_at_ingame, created_at", { count: "exact" })
    .eq("campaign_id", params.campaignId)
    .eq("source_entity_id", params.sourceEntityId)
    .eq("target_entity_id", params.targetEntityId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return { count: count ?? 0, last: data[0] ?? null };
}

/** La fiche d'un souvenir de personnalité ou de convictions — pour vérifier le droit d'écrire avant de le modifier. */
export async function getPersonalityEventEntityId(supabase: TypedClient, id: string): Promise<string | null> {
  const { data, error } = await supabase.from("personality_events").select("entity_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.entity_id ?? null;
}

/** V3.1-71 : la fiche qui ressent ce souvenir — pour vérifier le droit d'écrire avant de le modifier. */
export async function getAttitudeEventSourceId(supabase: TypedClient, id: string): Promise<string | null> {
  const { data, error } = await supabase.from("attitude_events").select("source_entity_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.source_entity_id ?? null;
}

/** Meme discipline que `updatePersonalityEventVisibility` ci-dessus. */
export async function updateAttitudeEventVisibility(
  supabase: TypedClient,
  id: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await supabase.from("attitude_events").update({ is_public: isPublic }).eq("id", id);
  if (error) throw new Error(error.message);
}
