import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Le nombre de paliers de titres (V3.1-87, tuile « Titres des joueurs ») : un comptage, aucune ligne lue. */
export async function countPlayerTitleTiers(supabase: TypedClient): Promise<number> {
  const { count, error } = await supabase.from("player_title_tiers").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
