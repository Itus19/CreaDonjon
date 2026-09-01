import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface EntityGrantRow {
  entity_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
}

/** V2-M3 (Lot M) — un seul point d'appel : `canEditEntity` (via `src/server/services/entities.ts`/`blocks.ts`), jamais une seconde requete ecrite ailleurs. */
export async function hasEntityGrant(supabase: TypedClient, params: { entityId: string; userId: string }): Promise<boolean> {
  const { data, error } = await supabase
    .from("entity_grants")
    .select("entity_id")
    .eq("entity_id", params.entityId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** V2-M7 (Lot M) : liste des octrois d'une entite, pour le panneau MJ. */
export async function listEntityGrants(supabase: TypedClient, entityId: string): Promise<EntityGrantRow[]> {
  const { data, error } = await supabase.from("entity_grants").select("entity_id, user_id, granted_by, granted_at").eq("entity_id", entityId);
  if (error) throw new Error(error.message);
  return data;
}

/** V2-M7 (Lot M) : meme chose que ci-dessus mais pour plusieurs entites d'un coup (les fiches PJ d'une campagne) — evite un aller-retour par fiche dans `GET /api/campaigns/[campaignId]`. */
export async function listEntityGrantsForEntityIds(supabase: TypedClient, entityIds: string[]): Promise<EntityGrantRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("entity_grants")
    .select("entity_id, user_id, granted_by, granted_at")
    .in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return data;
}

/** V2-M13 (retour utilisateur, coquille joueur : "la liste des fiches dont le joueur a l'accès d'édition") — pas de `world_id` sur `entity_grants` (juste `entity_id`/`user_id`), jointure via `entities` pour borner au monde, meme motif que `listPcEntityIdsForWorld`. */
export async function listEntityGrantsForUser(supabase: TypedClient, params: { worldId: string; userId: string }): Promise<EntityGrantRow[]> {
  const { data, error } = await supabase
    .from("entity_grants")
    .select("entity_id, user_id, granted_by, granted_at, entities!inner(world_id)")
    .eq("user_id", params.userId)
    .eq("entities.world_id", params.worldId);
  if (error) throw new Error(error.message);
  return data.map((row) => ({ entity_id: row.entity_id, user_id: row.user_id, granted_by: row.granted_by, granted_at: row.granted_at }));
}

export async function grantEntityAccess(
  supabase: TypedClient,
  params: { entityId: string; userId: string; grantedBy: string }
): Promise<EntityGrantRow> {
  const { data, error } = await supabase
    .from("entity_grants")
    .upsert(
      { entity_id: params.entityId, user_id: params.userId, granted_by: params.grantedBy },
      { onConflict: "entity_id,user_id" }
    )
    .select("entity_id, user_id, granted_by, granted_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function revokeEntityAccess(supabase: TypedClient, params: { entityId: string; userId: string }): Promise<void> {
  const { error } = await supabase.from("entity_grants").delete().eq("entity_id", params.entityId).eq("user_id", params.userId);
  if (error) throw new Error(error.message);
}
