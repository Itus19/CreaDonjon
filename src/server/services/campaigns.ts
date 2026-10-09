import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  claimOpenCharacter,
  findUserIdByEmail,
  getCampaignById,
  insertCampaign,
  insertCampaignMember,
  isCampaignMember,
  listCampaignCharacters,
  listCampaignMembers,
  listCampaignsForWorld,
  listGmCampaignsForUser,
  listUnclaimedPcEntityIds,
  revokeCampaignMember,
  updateCampaignMode,
  updateCampaignName,
  upsertCampaignCharacter,
  type CampaignCharacterRow,
  type CampaignMemberRow,
  type CampaignRow,
  type RevokeCampaignMemberResult,
} from "@/src/server/repos/campaigns";
import { getRulesetById } from "@/src/server/repos/rules";
import { getWorldOwnerId } from "@/src/server/repos/worlds";
import { createEntity, listEntities } from "@/src/server/services/entities";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listEntityGrantsForEntityIds, type EntityGrantRow } from "@/src/server/repos/entityGrants";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { isSuperadmin } from "@/src/server/services/account";
import { forcePasswordReset as forcePasswordResetForAccount, isSyntheticAccount } from "@/src/server/services/accountAuth";
import { canActOnMemberAccount, type MemberAccountAction, type MemberAccountDecision } from "@/src/core/accounts/memberAccountActions";

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

/** `React.cache()` (retour utilisateur : "recharge des choses déjà présentes") — "un monde = une campagne" (V2-G1), appelee independamment par de nombreux layouts/pages pour LA campagne du meme monde sur une seule requete. */
export const listCampaigns = cache(async function listCampaigns(supabase: TypedClient, worldId: string): Promise<CampaignSummary[]> {
  const rows = await listCampaignsForWorld(supabase, worldId);
  return rows.map(toSummary);
});

/** "Un monde = une campagne" (migration 20260826100001) : au plus une ligne. Reutilise partout ou une fonctionnalite doit se rattacher a "la" campagne d'un monde sans que l'appelant en connaisse deja l'id (quests.ts, sessions.ts, psyche.ts). */
export async function resolveCampaignId(supabase: TypedClient, worldId: string): Promise<string | null> {
  const campaigns = await listCampaigns(supabase, worldId);
  return campaigns[0]?.id ?? null;
}

export async function getCampaign(supabase: TypedClient, id: string): Promise<CampaignSummary | null> {
  const row = await getCampaignById(supabase, id);
  return row ? toSummary(row) : null;
}

/** V3.1-11 : le mode solo (V3, IA locale) n'a de sens que sans MJ humain — même motif que l'ancien `resolveNamesIncludingGm` de `scheduling.ts`. */
export async function hasHumanGm(supabase: TypedClient, campaignId: string): Promise<boolean> {
  const members = await listCampaignMembers(supabase, campaignId);
  return members.some((m) => m.role === "gm");
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

/**
 * Renommage depuis l'ecran de choix de monde (V2-M1) : verification
 * explicite du proprietaire du MONDE, pas seulement confiance en
 * `campaigns_write` — cette politique RLS autorise aujourd'hui l'ecriture a
 * n'importe quel membre du monde, pas seulement au proprietaire (resserre
 * par V2-M3, pas encore fait). Meme principe que `renameWorld`/
 * `deleteWorldWithConfirmation` (app/actions.ts) : la RLS reste un filet,
 * jamais la seule barriere (PDD §28).
 */
export async function renameCampaign(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; name: string }
): Promise<{ updated: boolean; error?: "not_found" | "forbidden" }> {
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return { updated: false, error: "not_found" };
  const ownerId = await getWorldOwnerId(supabase, campaign.world_id);
  if (ownerId !== params.userId) return { updated: false, error: "forbidden" };
  const row = await updateCampaignName(supabase, params.campaignId, params.name);
  return { updated: row !== null };
}

export async function getCampaignCharacters(supabase: TypedClient, campaignId: string): Promise<CampaignCharacterRow[]> {
  return listCampaignCharacters(supabase, campaignId);
}

/**
 * V2-M9 (Lot M, retour utilisateur : "un outil... qui reference ainsi TOUT
 * les octrois d'edition") : les octrois de N'IMPORTE QUELLE fiche du monde,
 * pas seulement celles deja attribuees comme personnage de campagne.
 * Remplace `getCampaignCharacterGrants` (V2-M7), dont le filtre par
 * `campaign_characters` cachait tout octroi sur une fiche de lore
 * quelconque (ex. un PNJ jamais attribue comme personnage) — trouve en
 * verifiant en direct que le panneau affichait "Aucun octroi" alors qu'un
 * octroi existait bel et bien en base. "Un monde = une campagne" : le monde
 * de cette campagne est la portee naturelle, pas d'authorization ici, meme
 * niveau de lecture que `getCampaignCharacters`/`getCampaignMembers`
 * ci-dessus (deja ouvert a tout membre via RLS).
 */
export async function getCampaignGrants(supabase: TypedClient, worldId: string): Promise<EntityGrantRow[]> {
  const entities = await listEntities(supabase, worldId, null);
  return listEntityGrantsForEntityIds(supabase, entities.map((e) => e.id));
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

/** Simple relais — voir `revokeCampaignMember` (repo) pour la logique reelle (V3.1-10). */
export async function revokeCampaignMemberAccess(
  supabase: TypedClient,
  params: { campaignId: string; userId: string }
): Promise<RevokeCampaignMemberResult> {
  return revokeCampaignMember(supabase, params);
}

export type ForceMemberPasswordResetResult = { ok: true; token: string } | { ok: false; reason: "not_authorized" | "not_found" };

/**
 * "Forcer une réinitialisation" (MJ d'un membre de cette campagne, ou
 * superadmin — V3.1-10) : verifie le droit ICI (le module confine
 * `accountAuth.ts` n'a pas de notion de "qui appelle"), puis relaie.
 *
 * ADR 0052 : un MJ ne vise qu'un MEMBRE de cette campagne, et seulement un
 * compte « tag ». Avant, n'importe quel administrateur de monde — donc
 * n'importe quel compte, la creation d'un monde etant libre — obtenait un
 * lien de reinitialisation pour n'importe quel identifiant.
 */
export async function forceMemberPasswordReset(
  supabase: TypedClient,
  params: { campaignId: string; targetUserId: string; actingUserId: string }
): Promise<ForceMemberPasswordResetResult> {
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };

  const decision = await decideMemberAccountAction(supabase, {
    action: "reset_password",
    campaign,
    callerId: params.actingUserId,
    targetUserId: params.targetUserId,
  });
  if (decision === "not_found") return { ok: false, reason: "not_found" };
  if (!decision.allowed) return { ok: false, reason: "not_authorized" };

  const result = await forcePasswordResetForAccount({ targetUserId: params.targetUserId, actingUserId: params.actingUserId });
  if (!result.ok) return { ok: false, reason: "not_found" };
  return { ok: true, token: result.token };
}

/**
 * Rassemble ce que `canActOnMemberAccount` (ADR 0052) doit savoir, depuis la
 * campagne d'ou le geste est fait. `not_found` si le compte vise n'existe pas.
 */
export async function decideMemberAccountAction(
  supabase: TypedClient,
  params: { action: MemberAccountAction; campaign: { id: string; world_id: string }; callerId: string; targetUserId: string }
): Promise<MemberAccountDecision | "not_found"> {
  const targetIsSyntheticAccount = await isSyntheticAccount(params.targetUserId);
  if (targetIsSyntheticAccount === null) return "not_found";
  const callerIsSuperadmin = await isSuperadmin(supabase, params.callerId);
  const callerManagesCampaign = callerIsSuperadmin ? false : await isWorldAdmin(supabase, { worldId: params.campaign.world_id, userId: params.callerId });
  const targetIsMember = await isCampaignMember(supabase, { campaignId: params.campaign.id, userId: params.targetUserId });
  return canActOnMemberAccount({ action: params.action, callerIsSuperadmin, callerManagesCampaign, targetIsMember, targetIsSyntheticAccount });
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

/** Ecran "Choisis ton personnage" (V3.1-10) : PJ ouverts avec leur nom affichable — jamais imposé à la création du compte, la joueuse choisit après coup. */
export async function listUnclaimedCharacters(
  supabase: TypedClient,
  campaignId: string
): Promise<{ entityId: string; entityName: string }[]> {
  const ids = await listUnclaimedPcEntityIds(supabase, campaignId);
  if (ids.length === 0) return [];
  const entities = await listEntitiesByIds(supabase, ids);
  return entities.map((e) => ({ entityId: e.id, entityName: e.name }));
}

export type ClaimOwnOpenCharacterResult = { ok: true } | { ok: false; reason: "already_taken" };

/** Reclame un PJ ouvert pour l'appelant lui-meme (V3.1-10) — jamais pour un autre compte, contrairement a `assignCampaignCharacter` (reserve au MJ, verifie par RLS). */
export async function claimOwnOpenCharacter(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string }
): Promise<ClaimOwnOpenCharacterResult> {
  const claimed = await claimOpenCharacter(supabase, params);
  return claimed ? { ok: true } : { ok: false, reason: "already_taken" };
}
