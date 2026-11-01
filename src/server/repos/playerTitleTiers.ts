import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zPlayerTitleTier, type PlayerTitleTier } from "@/src/core/stats/titleTiers";

type TypedClient = SupabaseClient<Database>;

/** Le nombre de paliers de titres (V3.1-87, tuile « Titres des joueurs ») : un comptage, aucune ligne lue. */
export async function countPlayerTitleTiers(supabase: TypedClient): Promise<number> {
  const { count, error } = await supabase.from("player_title_tiers").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Les paliers des titres (V3.1-91), validés par `zPlayerTitleTier` : une ligne
 * que le schéma refuse est écartée ET signalée (jamais avalée en silence) —
 * un réglage abîmé ne doit pas casser l'accueil de tous les joueurs.
 */
export async function listPlayerTitleTiers(supabase: TypedClient): Promise<PlayerTitleTier[]> {
  const { data, error } = await supabase
    .from("player_title_tiers")
    .select("family, position, range_from, range_to, action_kind, name, template, icon_key, color_token")
    .order("family")
    .order("position");
  if (error) throw new Error(error.message);
  return data.flatMap((row) => {
    const parsed = zPlayerTitleTier.safeParse({
      ...row,
      range_from: row.range_from === null ? null : Number(row.range_from),
      range_to: row.range_to === null ? null : Number(row.range_to),
    });
    if (!parsed.success) {
      console.error("Palier de titre invalide, écarté", row.family, row.name, parsed.error.issues[0]?.message);
      return [];
    }
    return [parsed.data];
  });
}
