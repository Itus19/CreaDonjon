import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { generateCampaignInviteToken, hashCampaignInviteToken } from "@/src/core/campaignInvites/token";
import {
  insertCampaignInvite,
  listCampaignInvitesForCampaign,
  listUnclaimedCampaignCharactersForToken,
  resolveCampaignInviteToken,
  revokeCampaignInvite,
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
  };
}

/**
 * Cree un lien nominatif (V2-M4, retour utilisateur 29 aout : "un lien par
 * personne mais tu leur demande leur nom aussi") — le jeton en clair n'est
 * renvoye qu'ICI, une seule fois : ni la table ni aucune fonction de
 * lecture ne le reconstituent ensuite (seul `token_hash` est stocke).
 */
export async function createCampaignInvite(
  supabase: TypedClient,
  params: { campaignId: string | null; worldId: string | null; intendedRole: "gm" | "player" | null; createdBy: string }
): Promise<{ invite: CampaignInviteSummary; token: string }> {
  const token = generateCampaignInviteToken();
  const invite = await insertCampaignInvite(supabase, {
    campaignId: params.campaignId,
    worldId: params.worldId,
    intendedRole: params.intendedRole,
    tokenHash: hashCampaignInviteToken(token),
    createdBy: params.createdBy,
  });
  return { invite: toSummary(invite), token };
}

export async function listCampaignInvites(supabase: TypedClient, campaignId: string): Promise<CampaignInviteSummary[]> {
  const rows = await listCampaignInvitesForCampaign(supabase, campaignId);
  return rows.map(toSummary);
}

export async function revokeInvite(supabase: TypedClient, id: string): Promise<{ revoked: boolean }> {
  const { updated } = await revokeCampaignInvite(supabase, id);
  return { revoked: updated };
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
