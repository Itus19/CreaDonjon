import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getEntityById } from "@/src/server/repos/entities";
import { listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import {
  grantEntityAccess,
  listEntityGrants,
  revokeEntityAccess,
  type EntityGrantRow,
} from "@/src/server/repos/entityGrants";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { resolveCampaignId } from "@/src/server/services/campaigns";

type TypedClient = SupabaseClient<Database>;

export type EntityGrantsResult = { ok: true; grants: EntityGrantRow[] } | { ok: false; reason: "not_found" | "forbidden" };
export type EntityGrantActionResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" };

export interface GrantCandidate {
  userId: string;
  displayName: string;
  granted: boolean;
}
export type GrantCandidatesResult =
  | { ok: true; candidates: GrantCandidate[] }
  | { ok: false; reason: "not_found" | "forbidden" };

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

/**
 * "A qui puis-je accorder CETTE fiche" (V2-M9, raccourci sidebar MJ) — les
 * joueurs de la campagne de ce monde (jamais les MJ, memes critere que le
 * selecteur existant `CampaignDetail.tsx`), avec leur nom affichable et si
 * l'octroi existe deja. Trouve en construisant ce raccourci : le panneau
 * "Octrois d'edition" existant n'affiche que les octrois sur des fiches deja
 * attribuees comme personnage de campagne (`getCampaignCharacterGrants`,
 * filtre par `campaign_characters`) — celui-ci fonctionne sur N'IMPORTE
 * QUELLE fiche du monde, cote serveur comme cote affichage.
 */
export async function listGrantCandidatesForEntity(
  supabase: TypedClient,
  params: { entityId: string; callerId: string }
): Promise<GrantCandidatesResult> {
  const check = await requireWorldAdminForEntity(supabase, { entityId: params.entityId, userId: params.callerId });
  if (!check.ok) return check;

  const campaignId = await resolveCampaignId(supabase, check.worldId);
  if (!campaignId) return { ok: true, candidates: [] };

  const [members, grants] = await Promise.all([
    listCampaignMembers(supabase, campaignId),
    listEntityGrants(supabase, params.entityId),
  ]);
  const players = members.filter((m) => m.role === "player");
  const grantedUserIds = new Set(grants.map((g) => g.user_id));
  const displayNames = await getDisplayNamesForUsers(
    supabase,
    players.map((p) => p.user_id)
  );

  return {
    ok: true,
    candidates: players.map((p) => ({
      userId: p.user_id,
      displayName: displayNames.get(p.user_id) || "Compte sans nom",
      granted: grantedUserIds.has(p.user_id),
    })),
  };
}
