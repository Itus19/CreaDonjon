import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-41 (ADR 0037) — l'autrice d'une page partagée réclame son octroi
 * d'écriture (`public.claim_shared_note_grant`, migration 20261013130000).
 * `false` si les conditions ne sont pas réunies (pas l'autrice, pas une page
 * partagée, ou déjà écrite) : l'appelant annule la création.
 */
export async function claimSharedNoteGrant(supabase: TypedClient, entityId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_shared_note_grant", { p_entity_id: entityId });
  if (error) throw new Error(error.message);
  return data === true;
}
