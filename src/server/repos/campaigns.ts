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

/** `"world_already_has_campaign"` : violation de `campaigns_world_id_unique` (migration 20260826100001, "un monde = une campagne") — jamais une exception non geree, un monde deja complete peut re-tenter cet appel (double-soumission, etat client perime). */
export async function insertCampaign(
  supabase: TypedClient,
  params: { worldId: string; name: string; rulesetId: string; mode: string; gmUserId: string | null; partyEntityId: string }
): Promise<CampaignRow | "world_already_has_campaign"> {
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
  if (error) {
    if (error.code === "23505") return "world_already_has_campaign";
    throw new Error(error.message);
  }
  return data;
}

/**
 * Bascule le mode d'une campagne (V2-G1 prepa, mode modifiable apres
 * creation par decision explicite de l'utilisateur) — `gm_user_id` suit la
 * meme regle qu'a la creation (`createCampaign`) : MJ humain en `campaign`,
 * `null` (l'IA) en `solo`.
 */
export async function updateCampaignMode(
  supabase: TypedClient,
  params: { campaignId: string; mode: string; gmUserId: string | null }
): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .update({ mode: params.mode, gm_user_id: params.gmUserId })
    .eq("id", params.campaignId)
    .is("deleted_at", null)
    .select(CAMPAIGN_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Change le ruleset epingle par une campagne (V2-G1 suite, "un monde = une
 * campagne") : le verrou d'origine ("une campagne epingle un ruleset precis,
 * jamais retroactif" — SCHEMA.md §9.5) protegeait les AUTRES campagnes d'un
 * meme monde d'un changement involontaire. Ce risque n'existe plus des lors
 * qu'un monde n'a plus qu'une seule campagne : `setActiveRuleset` propage
 * donc desormais le changement choisi en Reglages jusqu'ici, pour que les
 * jets et fiches de personnage utilisent reellement le ruleset affiche.
 */
export async function updateCampaignRuleset(supabase: TypedClient, params: { campaignId: string; rulesetId: string }): Promise<void> {
  const { error } = await supabase.from("campaigns").update({ ruleset_id: params.rulesetId }).eq("id", params.campaignId);
  if (error) throw new Error(error.message);
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

export interface GmCampaignRow {
  campaign_id: string;
  campaign_name: string;
  world_id: string;
  world_name: string;
  world_slug: string;
}

/**
 * Campagnes ou l'utilisateur courant est MJ, toutes mondes confondus
 * (V2-K7, onglet Collaboration des Reglages — pas de vue equivalente
 * avant ce ticket, `getCampaignRolesForWorld` etant deja bornee a un seul
 * monde). RLS filtre deja `campaign_members`/`campaigns`/`worlds` par
 * appartenance (SCHEMA.md §19) : rien a ajouter ici.
 */
export async function listGmCampaignsForUser(supabase: TypedClient, userId: string): Promise<GmCampaignRow[]> {
  const { data, error } = await supabase
    .from("campaign_members")
    .select("campaign_id, campaigns!inner(name, world_id, worlds!inner(name, slug))")
    .eq("user_id", userId)
    .eq("role", "gm");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    campaign_id: row.campaign_id,
    campaign_name: row.campaigns.name,
    world_id: row.campaigns.world_id,
    world_name: row.campaigns.worlds.name,
    world_slug: row.campaigns.worlds.slug,
  }));
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
