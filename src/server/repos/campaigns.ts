import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface CampaignRow {
  id: string;
  world_id: string;
  name: string;
  ruleset_id: string;
  gm_user_id: string | null;
  mode: string;
  party_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

const CAMPAIGN_COLUMNS = "id, world_id, name, ruleset_id, gm_user_id, mode, party_entity_id, created_at, updated_at";

export async function listCampaignsForWorld(supabase: TypedClient, worldId: string): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getCampaignById(supabase: TypedClient, id: string): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertCampaign(
  supabase: TypedClient,
  params: { worldId: string; name: string; rulesetId: string; mode: string; gmUserId: string | null; partyEntityId: string }
): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      world_id: params.worldId,
      name: params.name,
      ruleset_id: params.rulesetId,
      mode: params.mode,
      gm_user_id: params.gmUserId,
      party_entity_id: params.partyEntityId,
    })
    .select(CAMPAIGN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CampaignMemberRow {
  campaign_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export async function listCampaignMembers(supabase: TypedClient, campaignId: string): Promise<CampaignMemberRow[]> {
  const { data, error } = await supabase
    .from("campaign_members")
    .select("campaign_id, user_id, role, joined_at")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data;
}

export async function insertCampaignMember(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; role: string }
): Promise<CampaignMemberRow> {
  const { data, error } = await supabase
    .from("campaign_members")
    .upsert(
      { campaign_id: params.campaignId, user_id: params.userId, role: params.role },
      { onConflict: "campaign_id,user_id" }
    )
    .select("campaign_id, user_id, role, joined_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CampaignCharacterRow {
  campaign_id: string;
  entity_id: string;
  user_id: string | null;
  is_pc: boolean;
}

export async function listCampaignCharacters(supabase: TypedClient, campaignId: string): Promise<CampaignCharacterRow[]> {
  const { data, error } = await supabase
    .from("campaign_characters")
    .select("campaign_id, entity_id, user_id, is_pc")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data;
}

/** `campaign_characters` a pour cle primaire litterale (campaign_id, entity_id) — un upsert direct fonctionne ici, contrairement a `entity_runtime_state` (index sur une expression, V1-B3). */
export async function upsertCampaignCharacter(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string | null; isPc: boolean }
): Promise<CampaignCharacterRow> {
  const { data, error } = await supabase
    .from("campaign_characters")
    .upsert(
      { campaign_id: params.campaignId, entity_id: params.entityId, user_id: params.userId, is_pc: params.isPc },
      { onConflict: "campaign_id,entity_id" }
    )
    .select("campaign_id, entity_id, user_id, is_pc")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Resout un email en id de compte, sans jamais lire `auth.users` depuis
 * l'application (SCHEMA.md §3) : passe par `find_user_id_by_email`
 * (migration 20260804140001), une fonction `security definer` etroite qui
 * ne renvoie qu'un id, meme patron que `resolve_share_link`. `null` si
 * aucun compte n'existe pour cet email.
 */
export async function findUserIdByEmail(supabase: TypedClient, email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_user_id_by_email", { p_email: email });
  if (error) throw new Error(error.message);
  return data;
}
