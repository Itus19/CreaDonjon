import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface CampaignInviteRow {
  id: string;
  campaign_id: string | null;
  world_id: string | null;
  intended_role: string | null;
  claimed_by_user_id: string | null;
  claimed_name: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
}

const CAMPAIGN_INVITE_COLUMNS =
  "id, campaign_id, world_id, intended_role, claimed_by_user_id, claimed_name, revoked_at, created_by, created_at";

export async function insertCampaignInvite(
  supabase: TypedClient,
  params: {
    campaignId: string | null;
    worldId: string | null;
    intendedRole: "gm" | "player" | null;
    tokenHash: string;
    createdBy: string;
  }
): Promise<CampaignInviteRow> {
  const { data, error } = await supabase
    .from("campaign_invites")
    .insert({
      campaign_id: params.campaignId,
      world_id: params.worldId,
      intended_role: params.intendedRole,
      token_hash: params.tokenHash,
      created_by: params.createdBy,
    })
    .select(CAMPAIGN_INVITE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCampaignInvitesForCampaign(supabase: TypedClient, campaignId: string): Promise<CampaignInviteRow[]> {
  const { data, error } = await supabase
    .from("campaign_invites")
    .select(CAMPAIGN_INVITE_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function revokeCampaignInvite(supabase: TypedClient, id: string): Promise<{ updated: boolean }> {
  const { data, error } = await supabase.from("campaign_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

export interface ResolvedCampaignInvite {
  id: string;
  campaignId: string | null;
  worldId: string | null;
  intendedRole: "gm" | "player" | null;
  claimedByUserId: string | null;
  claimedName: string | null;
}

/**
 * Passe par `public.resolve_campaign_invite` (migration 20260830130001,
 * meme patron que `resolve_share_link`) : la cle anon suffit, aucune
 * session necessaire — l'ami n'en a justement pas encore au premier
 * passage. `null` couvre "jamais existe" ET "revoque" (meme choix de
 * confidentialite que le partage public : ne jamais reveler qu'un lien a
 * existe).
 */
export async function resolveCampaignInviteToken(supabase: TypedClient, token: string): Promise<ResolvedCampaignInvite | null> {
  const { data, error } = await supabase.rpc("resolve_campaign_invite", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    worldId: row.world_id,
    intendedRole: row.intended_role as "gm" | "player" | null,
    claimedByUserId: row.claimed_by_user_id,
    claimedName: row.claimed_name,
  };
}

export interface UnclaimedCampaignCharacter {
  entityId: string;
  entityName: string;
}

/**
 * Passe par `public.list_unclaimed_campaign_characters` (migration
 * 20260830140001) : revalide le jeton lui-meme cote SQL avant de renvoyer
 * quoi que ce soit — jamais un `campaignId` fourni tel quel par l'appelant.
 */
export async function listUnclaimedCampaignCharactersForToken(
  supabase: TypedClient,
  token: string
): Promise<UnclaimedCampaignCharacter[]> {
  const { data, error } = await supabase.rpc("list_unclaimed_campaign_characters", { p_token: token });
  if (error) throw new Error(error.message);
  return data.map((row) => ({ entityId: row.entity_id, entityName: row.entity_name }));
}
