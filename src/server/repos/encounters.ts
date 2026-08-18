import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface CampaignEncounterParticipant {
  entryKey: string;
  name: string;
  challengeRatingLabel: string;
  xp: number;
  count: number;
}

export interface CampaignEncounterRow {
  id: string;
  campaign_id: string;
  name: string;
  party_size: number;
  party_level: number;
  band: string | null;
  participants: CampaignEncounterParticipant[];
  created_at: string;
}

const ENCOUNTER_COLUMNS = "id, campaign_id, name, party_size, party_level, band, participants, created_at";

/** "Mes combats" (V1-E3, specs/outils-mj.md §4.3) — les plus recentes d'abord, meme convention que les autres listes de campagne. */
export async function listCampaignEncounters(supabase: TypedClient, campaignId: string): Promise<CampaignEncounterRow[]> {
  const { data, error } = await supabase
    .from("campaign_encounters")
    .select(ENCOUNTER_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as CampaignEncounterRow[];
}

export async function insertCampaignEncounter(
  supabase: TypedClient,
  params: {
    campaignId: string;
    name: string;
    partySize: number;
    partyLevel: number;
    band: string | null;
    participants: CampaignEncounterParticipant[];
    createdBy: string | null;
  }
): Promise<CampaignEncounterRow> {
  const { data, error } = await supabase
    .from("campaign_encounters")
    .insert({
      campaign_id: params.campaignId,
      name: params.name,
      party_size: params.partySize,
      party_level: params.partyLevel,
      band: params.band,
      participants: params.participants as unknown as Database["public"]["Tables"]["campaign_encounters"]["Insert"]["participants"],
      created_by: params.createdBy,
    })
    .select(ENCOUNTER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CampaignEncounterRow;
}
