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
  occurred_at_ingame: string | null;
  created_at: string;
}

/** Journal en ajout seul (docs/adr/0013-tables-psyche-pnj.md) — jamais de mise a jour ni de suppression ici. */
export async function insertPersonalityEvent(
  supabase: TypedClient,
  params: {
    entityId: string;
    summary: string;
    deltas: Json;
    origin: string;
    sessionEventId: string | null;
    occurredAtIngame: string | null;
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
    .select("id, entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
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
    .select("id, entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
