import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { mergeTableSettings, parseTableSettings, type CampaignTableSettings, type CampaignTableSettingsPatch } from "@/src/core/campaigns/tableSettings";
import { getCampaignById, getCampaignTableSettingsRaw, updateCampaignTableSettings } from "@/src/server/repos/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/** V3.1-108 — lecture des reglages de table : tout membre du monde (RLS de `campaigns`), complets avec les defauts. */
export async function readTableSettings(supabase: TypedClient, campaignId: string): Promise<CampaignTableSettings | "not_found"> {
  const raw = await getCampaignTableSettingsRaw(supabase, campaignId);
  return raw === undefined ? "not_found" : parseTableSettings(raw);
}

/**
 * V3.1-108 — ecriture d'un reglage par le MJ. Refuse avant de dire si la
 * campagne existe ; la RLS (`campaigns_write` : is_world_admin) le
 * reverifierait de toute facon.
 */
export async function writeTableSettings(
  supabase: TypedClient,
  params: { userId: string; campaignId: string; patch: CampaignTableSettingsPatch }
): Promise<CampaignTableSettings | "forbidden" | "not_found"> {
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return "not_found";
  if (!(await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: params.userId }))) return "forbidden";
  const current = parseTableSettings(await getCampaignTableSettingsRaw(supabase, params.campaignId));
  const next = mergeTableSettings(current, params.patch);
  const written = await updateCampaignTableSettings(supabase, { campaignId: params.campaignId, settings: next as unknown as Json });
  return written ? next : "forbidden";
}
