import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getEntityById } from "@/src/server/repos/entities";
import {
  grantEntityAccess,
  listEntityGrants,
  revokeEntityAccess,
  type EntityGrantRow,
} from "@/src/server/repos/entityGrants";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

export type EntityGrantsResult = { ok: true; grants: EntityGrantRow[] } | { ok: false; reason: "not_found" | "forbidden" };
export type EntityGrantActionResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" };

/**
 * "Le MJ de ce monde peut-il gerer les octrois de CETTE entite" (V2-M7) —
 * meme geste que `canUserEditEntityById` (resoudre `worldId` depuis
 * l'entite), mais teste `isWorldAdmin` plutot que `canEditEntity` : accorder
 * l'edition d'une fiche est un geste de MJ (RLS `entity_grants_write`,
 * migration 20260830110001), jamais quelque chose qu'un beneficiaire
 * s'accorde lui-meme via sa propre fiche ou un octroi existant.
 */
async function requireWorldAdminForEntity(
  supabase: TypedClient,
  params: { entityId: string; userId: string }
): Promise<{ ok: true; worldId: string } | { ok: false; reason: "not_found" | "forbidden" }> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return { ok: false, reason: "not_found" };
  const allowed = await isWorldAdmin(supabase, { worldId: entity.world_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };
  return { ok: true, worldId: entity.world_id };
}

export async function listGrantsForEntity(
  supabase: TypedClient,
  params: { entityId: string; callerId: string }
): Promise<EntityGrantsResult> {
  const check = await requireWorldAdminForEntity(supabase, { entityId: params.entityId, userId: params.callerId });
  if (!check.ok) return check;
  const grants = await listEntityGrants(supabase, params.entityId);
  return { ok: true, grants };
}

export async function grantEntityEditAccess(
  supabase: TypedClient,
  params: { entityId: string; granteeUserId: string; callerId: string }
): Promise<EntityGrantActionResult> {
  const check = await requireWorldAdminForEntity(supabase, { entityId: params.entityId, userId: params.callerId });
  if (!check.ok) return check;
  await grantEntityAccess(supabase, { entityId: params.entityId, userId: params.granteeUserId, grantedBy: params.callerId });
  return { ok: true };
}

export async function revokeEntityEditAccess(
  supabase: TypedClient,
  params: { entityId: string; granteeUserId: string; callerId: string }
): Promise<EntityGrantActionResult> {
  const check = await requireWorldAdminForEntity(supabase, { entityId: params.entityId, userId: params.callerId });
  if (!check.ok) return check;
  await revokeEntityAccess(supabase, { entityId: params.entityId, userId: params.granteeUserId });
  return { ok: true };
}
