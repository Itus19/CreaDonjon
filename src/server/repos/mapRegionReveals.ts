import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Cles de zones revelees pour cette campagne (V2-I2, brouillard de guerre) — toutes, jamais filtrees par un lot precis : un bloc porte rarement plus de quelques dizaines de zones. */
export async function listRevealedRegionIds(supabase: TypedClient, campaignId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("map_region_reveals").select("region_id").eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return new Set(data.map((row) => row.region_id));
}

export async function isRegionRevealed(supabase: TypedClient, campaignId: string, regionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("map_region_reveals")
    .select("region_id")
    .eq("campaign_id", campaignId)
    .eq("region_id", regionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Idempotent par construction (cle primaire composite) — jamais un doublon si le MJ revele deux fois la meme zone. */
export async function insertRegionReveal(supabase: TypedClient, params: { campaignId: string; regionId: string }): Promise<void> {
  const { error } = await supabase
    .from("map_region_reveals")
    .upsert({ campaign_id: params.campaignId, region_id: params.regionId }, { onConflict: "campaign_id,region_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
