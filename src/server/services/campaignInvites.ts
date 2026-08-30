import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { generateCampaignInviteToken, hashCampaignInviteToken } from "@/src/core/campaignInvites/token";
import { hashSharePassword, verifySharePassword } from "@/src/core/shareLinks/password";
import {
  getOwnCampaignInvite,
  insertCampaignInvite,
  listCampaignInvitesForCampaign,
  listUnclaimedCampaignCharactersForToken,
  recordCampaignInvitePasswordAttempt,
  resolveCampaignInviteToken,
  revokeCampaignInvite,
  setCampaignInvitePasswordHash,
  type CampaignInviteRow,
  type ResolvedCampaignInvite,
  type UnclaimedCampaignCharacter,
} from "@/src/server/repos/campaignInvites";
import { provisionInviteSession, type ProvisionInviteResult } from "@/src/server/services/accountProvisioning";
import { getCampaignById, getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { getWorldById } from "@/src/server/repos/worlds";
import { getEntityById } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface CampaignInviteSummary {
  id: string;
  campaignId: string | null;
  worldId: string | null;
  intendedRole: "gm" | "player" | null;
  claimedByUserId: string | null;
  claimedName: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** Recuperable a tout moment (retour utilisateur 30 aout, meme choix que share_links) — jamais `null` pour un lien cree apres la migration 20260830160001. */
  token: string | null;
  hasPassword: boolean;
}

function toSummary(row: CampaignInviteRow): CampaignInviteSummary {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    worldId: row.world_id,
    intendedRole: row.intended_role as "gm" | "player" | null,
    claimedByUserId: row.claimed_by_user_id,
    claimedName: row.claimed_name,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    token: row.token,
    hasPassword: row.password_hash !== null,
  };
}

/**
 * Cree un lien nominatif (V2-M4, retour utilisateur 29 aout : "un lien par
 * personne mais tu leur demande leur nom aussi"). Le jeton en clair est
 * desormais conserve (retour utilisateur 30 aout, meme choix que
 * `share_links` — migration 20260826180001) : recuperable plus tard via
 * `listCampaignInvites`, pas seulement au moment de cet appel.
 */
export async function createCampaignInvite(
  supabase: TypedClient,
  params: {
    campaignId: string | null;
    worldId: string | null;
    intendedRole: "gm" | "player" | null;
    password?: string;
    createdBy: string;
  }
): Promise<{ invite: CampaignInviteSummary; token: string }> {
  const token = generateCampaignInviteToken();
  const invite = await insertCampaignInvite(supabase, {
    campaignId: params.campaignId,
    worldId: params.worldId,
    intendedRole: params.intendedRole,
    token,
    tokenHash: hashCampaignInviteToken(token),
    passwordHash: params.password ? hashSharePassword(params.password) : null,
    createdBy: params.createdBy,
  });
  return { invite: toSummary(invite), token };
}

export async function listCampaignInvites(supabase: TypedClient, campaignId: string): Promise<CampaignInviteSummary[]> {
  const rows = await listCampaignInvitesForCampaign(supabase, campaignId);
  return rows.map(toSummary);
}

/** « Mon lien » (V2-M4 suite) : l'invite reclame par CET utilisateur, s'il en a un — jamais celui d'un autre (`campaign_invites_select_own`, RLS). */
export async function getMyInvite(supabase: TypedClient, userId: string): Promise<CampaignInviteSummary | null> {
  const row = await getOwnCampaignInvite(supabase, userId);
  return row ? toSummary(row) : null;
}

export async function revokeInvite(supabase: TypedClient, id: string): Promise<{ revoked: boolean }> {
  const { updated } = await revokeCampaignInvite(supabase, id);
  return { revoked: updated };
}

/**
 * Definit/change/efface (`password: null`) le mot de passe d'un lien —
 * reserve au superadmin/MJ du monde OU a la personne qui l'a reclame,
 * verifie a l'interieur de `app.set_campaign_invite_password` (jamais par
 * une politique RLS large sur toute la ligne).
 */
export async function setInvitePassword(
  supabase: TypedClient,
  params: { inviteId: string; password: string | null }
): Promise<{ allowed: boolean }> {
  return setCampaignInvitePasswordHash(supabase, {
    inviteId: params.inviteId,
    passwordHash: params.password ? hashSharePassword(params.password) : null,
  });
}

const MAX_PASSWORD_ATTEMPTS = 10;

export type InvitePasswordResult = "ok" | "wrong" | "locked" | "not_required";

/**
 * Verifie le mot de passe d'un lien d'invitation (meme doctrine que
 * `verifyShareLinkPassword`) : re-resout le jeton pour lire le compteur de
 * tentatives a jour, au cas ou plusieurs essais arrivent en parallele.
 */
export async function verifyInvitePassword(supabase: TypedClient, token: string, password: string): Promise<InvitePasswordResult> {
  const resolved = await resolveCampaignInviteToken(supabase, token);
  if (!resolved) return "wrong";
  if (!resolved.passwordHash) return "not_required";
  if (resolved.passwordAttempts >= MAX_PASSWORD_ATTEMPTS) return "locked";

  const success = verifySharePassword(password, resolved.passwordHash);
  await recordCampaignInvitePasswordAttempt(supabase, token, success);
  return success ? "ok" : "wrong";
}

export type ResolveInviteForJoinResult =
  | { ok: true; invite: ResolvedCampaignInvite }
  | { ok: false };

/** Cote page `/rejoindre/[token]`, avant toute session — passe par la fonction anonyme (repo), jamais une lecture directe de la table. */
export async function resolveInviteForJoin(supabase: TypedClient, token: string): Promise<ResolveInviteForJoinResult> {
  const invite = await resolveCampaignInviteToken(supabase, token);
  if (!invite) return { ok: false };
  return { ok: true, invite };
}

export async function listUnclaimedCharactersForToken(supabase: TypedClient, token: string): Promise<UnclaimedCampaignCharacter[]> {
  return listUnclaimedCampaignCharactersForToken(supabase, token);
}

/** Simple relais vers le module confine — voir accountProvisioning.ts pour la logique reelle. */
export async function claimInvite(params: {
  invite: ResolvedCampaignInvite;
  claim?: { role: "gm" | "player"; name: string; entityId?: string };
  existingUserId?: string;
}): Promise<ProvisionInviteResult> {
  return provisionInviteSession(params);
}

/**
 * Ou rediriger apres l'etablissement de la session — MEME logique pour la
 * toute premiere reclamation et pour la reouverture du lien plus tard
 * (specs/module-joueur-et-solo.md §A5) : on ne se fie jamais a un role/
 * entityId transmis par le formulaire, on relit l'etat reel
 * (`campaign_characters`) une fois la session ouverte, sous la RLS
 * ordinaire de l'ami desormais connecte.
 */
export async function resolveDestinationForInvitedUser(
  supabase: TypedClient,
  invite: ResolvedCampaignInvite,
  userId: string
): Promise<string> {
  if (invite.campaignId) {
    const campaign = await getCampaignById(supabase, invite.campaignId);
    if (campaign) {
      const world = await getWorldById(supabase, campaign.world_id);
      if (world) {
        const entityId = await getClaimedCharacterEntityId(supabase, { campaignId: invite.campaignId, userId });
        if (entityId) {
          const entity = await getEntityById(supabase, entityId);
          if (entity) return `/m/${world.slug}/f/${entity.slug}`;
        }
        return `/m/${world.slug}`;
      }
    }
  }
  if (invite.worldId) {
    const world = await getWorldById(supabase, invite.worldId);
    if (world) return `/m/${world.slug}`;
  }
  return "/";
}
