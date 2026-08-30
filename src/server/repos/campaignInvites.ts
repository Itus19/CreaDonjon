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
  token: string | null;
  password_hash: string | null;
}

const CAMPAIGN_INVITE_COLUMNS =
  "id, campaign_id, world_id, intended_role, claimed_by_user_id, claimed_name, revoked_at, created_by, created_at, token, password_hash";

export async function insertCampaignInvite(
  supabase: TypedClient,
  params: {
    campaignId: string | null;
    worldId: string | null;
    intendedRole: "gm" | "player" | null;
    token: string;
    tokenHash: string;
    passwordHash: string | null;
    createdBy: string;
  }
): Promise<CampaignInviteRow> {
  const { data, error } = await supabase
    .from("campaign_invites")
    .insert({
      campaign_id: params.campaignId,
      world_id: params.worldId,
      intended_role: params.intendedRole,
      token: params.token,
      token_hash: params.tokenHash,
      password_hash: params.passwordHash,
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
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/** V2-M4 (suite) : « mon lien », pour l'ecran de l'ami invite lui-meme — jamais la liste d'un autre (`campaign_invites_select_own`, RLS). */
export async function getOwnCampaignInvite(supabase: TypedClient, userId: string): Promise<CampaignInviteRow | null> {
  const { data, error } = await supabase
    .from("campaign_invites")
    .select(CAMPAIGN_INVITE_COLUMNS)
    .eq("claimed_by_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function revokeCampaignInvite(supabase: TypedClient, id: string): Promise<{ updated: boolean }> {
  const { data, error } = await supabase.from("campaign_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  return { updated: data.length > 0 };
}

/**
 * Passe par `app.set_campaign_invite_password` (migration 20260830160001) :
 * ne touche jamais qu'une seule colonne, et verifie ELLE-MEME le droit
 * (superadmin/MJ du monde OU la personne qui a reclame ce lien) — jamais
 * une ecriture large sur la ligne entiere qui laisserait un ami reecrire
 * son propre role ou la campagne visee.
 */
export async function setCampaignInvitePasswordHash(
  supabase: TypedClient,
  params: { inviteId: string; passwordHash: string | null }
): Promise<{ allowed: boolean }> {
  const { data, error } = await supabase.rpc("set_campaign_invite_password", {
    p_invite_id: params.inviteId,
    // Le parametre SQL accepte NULL (efface le mot de passe) ; le type
    // genere ne le sait pas car la fonction ne declare pas `default null`
    // explicitement — cast assume, verifie par le test d'integration.
    p_password_hash: params.passwordHash as string,
  });
  if (error) throw new Error(error.message);
  return { allowed: data === true };
}

export interface ResolvedCampaignInvite {
  id: string;
  campaignId: string | null;
  worldId: string | null;
  intendedRole: "gm" | "player" | null;
  claimedByUserId: string | null;
  claimedName: string | null;
  passwordHash: string | null;
  passwordAttempts: number;
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
    passwordHash: row.password_hash,
    passwordAttempts: row.password_attempts,
  };
}

/** Journalise une tentative de mot de passe (`app.record_campaign_invite_password_attempt`, meme motif que le partage public). */
export async function recordCampaignInvitePasswordAttempt(supabase: TypedClient, token: string, success: boolean): Promise<void> {
  const { error } = await supabase.rpc("record_campaign_invite_password_attempt", { p_token: token, p_success: success });
  if (error) throw new Error(error.message);
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
