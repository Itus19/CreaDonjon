import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  findUserIdByEmail,
  getCampaignById,
  insertCampaign,
  insertCampaignMember,
  listCampaignCharacters,
  listCampaignMembers,
  listCampaignsForWorld,
  upsertCampaignCharacter,
  type CampaignCharacterRow,
  type CampaignMemberRow,
  type CampaignRow,
} from "@/src/server/repos/campaigns";
import { getRulesetById } from "@/src/server/repos/rules";
import { createEntity } from "@/src/server/services/entities";

type TypedClient = SupabaseClient<Database>;

export interface CampaignSummary {
  id: string;
  worldId: string;
  name: string;
  rulesetId: string;
  gmUserId: string | null;
  mode: string;
  partyEntityId: string | null;
  createdAt: string;
}

function toSummary(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    worldId: row.world_id,
    name: row.name,
    rulesetId: row.ruleset_id,
    gmUserId: row.gm_user_id,
    mode: row.mode,
    partyEntityId: row.party_entity_id,
    createdAt: row.created_at,
  };
}

export async function listCampaigns(supabase: TypedClient, worldId: string): Promise<CampaignSummary[]> {
  const rows = await listCampaignsForWorld(supabase, worldId);
  return rows.map(toSummary);
}

export async function getCampaign(supabase: TypedClient, id: string): Promise<CampaignSummary | null> {
  const row = await getCampaignById(supabase, id);
  return row ? toSummary(row) : null;
}

/**
 * Origine du ruleset epingle par une campagne (V1-D5, specs/ruleset-personnel.md
 * §3.1) : "inviter un membre reste autorise, avec un rappel explicite du
 * cadre" — pas un refus, juste de quoi afficher le rappel cote UI avant
 * l'invitation. `null` si la campagne ou son ruleset sont introuvables.
 */
export async function getCampaignRulesetOrigin(supabase: TypedClient, campaignId: string): Promise<string | null> {
  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) return null;
  const ruleset = await getRulesetById(supabase, campaign.ruleset_id);
  return ruleset?.content_origin ?? null;
}

/**
 * Cree une campagne et sa faction (V1-C1, `docs/adr/0008-campagne-entite-faction.md`) :
 * l'entite `faction` existe **avant** la ligne `campaigns`, jamais l'inverse
 * — la fenetre sans faction reste la plus courte possible. Le createur
 * devient MJ humain en mode `campaign`, simple joueur en mode `solo` (le MJ
 * y est l'IA, `gm_user_id` reste `null`, SCHEMA.md §11).
 */
export async function createCampaign(
  supabase: TypedClient,
  params: { worldId: string; createdBy: string; name: string; rulesetId: string; mode: "campaign" | "solo" }
): Promise<CampaignSummary> {
  const partyEntity = await createEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.createdBy,
    name: `Groupe — ${params.name}`,
    entityKind: "faction",
    aliases: [],
  });

  const campaign = await insertCampaign(supabase, {
    worldId: params.worldId,
    name: params.name,
    rulesetId: params.rulesetId,
    mode: params.mode,
    gmUserId: params.mode === "campaign" ? params.createdBy : null,
    partyEntityId: partyEntity.id,
  });

  await insertCampaignMember(supabase, {
    campaignId: campaign.id,
    userId: params.createdBy,
    role: params.mode === "campaign" ? "gm" : "player",
  });

  return toSummary(campaign);
}

export async function getCampaignMembers(supabase: TypedClient, campaignId: string): Promise<CampaignMemberRow[]> {
  return listCampaignMembers(supabase, campaignId);
}

export async function getCampaignCharacters(supabase: TypedClient, campaignId: string): Promise<CampaignCharacterRow[]> {
  return listCampaignCharacters(supabase, campaignId);
}

export type InviteResult = { ok: true; userId: string } | { ok: false; reason: "not_found" };

/** Invitation par email (V1-C1) : aucun compte trouve => `not_found`, jamais une erreur serveur — l'appelant decide comment le signaler (rien a inventer cote invite-par-lien tant que la personne n'a pas de compte, SCHEMA.md §3). */
export async function inviteCampaignMember(
  supabase: TypedClient,
  params: { campaignId: string; email: string; role: "gm" | "player" }
): Promise<InviteResult> {
  const userId = await findUserIdByEmail(supabase, params.email);
  if (!userId) return { ok: false, reason: "not_found" };
  await insertCampaignMember(supabase, { campaignId: params.campaignId, userId, role: params.role });
  return { ok: true, userId };
}

export async function assignCampaignCharacter(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string | null; isPc: boolean }
): Promise<CampaignCharacterRow> {
  return upsertCampaignCharacter(supabase, params);
}
