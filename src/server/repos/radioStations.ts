import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RadioStationRow {
  id: string;
  world_id: string;
  label: string;
  url: string;
  display_order: number;
  created_by: string;
  created_at: string;
}

const RADIO_STATION_COLUMNS = "id, world_id, label, url, display_order, created_by, created_at";

/** Stations radio du monde (retour utilisateur : "les stations radio sont celles que le MJ met en place pour ce monde") — RLS `world_radio_stations_select` filtre deja aux membres, jamais un second filtre ici. */
export async function listRadioStationsForWorld(supabase: TypedClient, worldId: string): Promise<RadioStationRow[]> {
  const { data, error } = await supabase
    .from("world_radio_stations")
    .select(RADIO_STATION_COLUMNS)
    .eq("world_id", worldId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function insertRadioStation(
  supabase: TypedClient,
  params: { worldId: string; label: string; url: string; createdBy: string }
): Promise<RadioStationRow> {
  const { data, error } = await supabase
    .from("world_radio_stations")
    .insert({ world_id: params.worldId, label: params.label, url: params.url, created_by: params.createdBy })
    .select(RADIO_STATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** `select().maybeSingle()` apres l'effacement : RLS `world_radio_stations_delete` rejette silencieusement une ligne hors de portee (0 ligne, pas d'erreur) — l'appelant distingue ainsi "supprime" de "refuse/introuvable". */
export async function deleteRadioStation(supabase: TypedClient, id: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from("world_radio_stations").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
