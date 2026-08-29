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
  listGmCampaignsForUser,
  updateCampaignMode,
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

/** "Un monde = une campagne" (migration 20260826100001) : au plus une ligne. Reutilise partout ou une fonctionnalite doit se rattacher a "la" campagne d'un monde sans que l'appelant en connaisse deja l'id (quests.ts, sessions.ts, psyche.ts). */
export async function resolveCampaignId(supabase: TypedClient, worldId: string): Promise<string | null> {
  const campaigns = await listCampaigns(supabase, worldId);
  return campaigns[0]?.id ?? null;
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
 *
 * `"world_already_has_campaign"` (V2-G1 prepa, "un monde = une campagne") :
 * la contrainte d'unicite (migration 20260826100001) a rejete l'insertion —
 * la faction, elle, reste creee (fenetre de risque acceptee, deja le cas
 * pour cet enchainement sans transaction explicite) ; l'appelant ne doit
 * jamais pretendre un succes dans ce cas.
 */
export async function createCampaign(
  supabase: TypedClient,
  params: { worldId: string; createdBy: string; name: string; rulesetId: string; mode: "campaign" | "solo" }
): Promise<CampaignSummary | "world_already_has_campaign"> {
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
  if (campaign === "world_already_has_campaign") return campaign;

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

/**
 * Mode modifiable apres creation (V2-G1 prepa, "un monde = une campagne") :
 * `gmUserId` suit la meme regle qu'a la creation — celui qui bascule vers
 * `campaign` en devient le MJ humain, `null` (l'IA) en `solo`. `null` si la
 * campagne est introuvable.
 */
export async function setCampaignMode(
  supabase: TypedClient,
  params: { campaignId: string; mode: "campaign" | "solo"; actorUserId: string }
): Promise<CampaignSummary | null> {
  const row = await updateCampaignMode(supabase, {
    campaignId: params.campaignId,
    mode: params.mode,
    gmUserId: params.mode === "campaign" ? params.actorUserId : null,
  });
  return row ? toSummary(row) : null;
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

export interface GmCampaignSummary {
  campaignId: string;
  campaignName: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  members: { userId: string; role: string }[];
}

/**
 * Vue transversale pour l'onglet Collaboration des Reglages (V2-K7) :
 * toutes les campagnes dont l'utilisateur courant est MJ, mondes
 * confondus, avec leurs membres actuels. Une requete par campagne pour la
 * liste des membres (N+1 assume) — un MJ gere en pratique quelques
 * campagnes, pas des milliers ; a mesurer avant d'optimiser si ca devient
 * un vrai probleme (meme principe que V2-G6).
 */
export async function listMyGmCampaignsWithMembers(supabase: TypedClient, userId: string): Promise<GmCampaignSummary[]> {
  const rows = await listGmCampaignsForUser(supabase, userId);
  const summaries: GmCampaignSummary[] = [];
  for (const row of rows) {
    const members = await listCampaignMembers(supabase, row.campaign_id);
    summaries.push({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      worldId: row.world_id,
      worldName: row.world_name,
      worldSlug: row.world_slug,
      members: members.map((m) => ({ userId: m.user_id, role: m.role })),
    });
  }
  return summaries;
}

export async function assignCampaignCharacter(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string | null; isPc: boolean }
): Promise<CampaignCharacterRow> {
  return upsertCampaignCharacter(supabase, params);
}
