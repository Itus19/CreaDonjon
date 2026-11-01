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

/**
 * V3.1-92 — Remplace TOUS les paliers par `tiers`, sans jamais laisser la
 * table vide : on insère d'abord le nouveau jeu, puis on retire l'ancien
 * (par ses identifiants, lus avant). Un échec à l'insertion ne change rien ;
 * un échec au retrait laisse les deux jeux côte à côte, et l'erreur remonte.
 * La RLS (`player_title_tiers_write`) n'ouvre l'écriture qu'au superadmin.
 */
export async function replacePlayerTitleTiers(supabase: TypedClient, tiers: readonly PlayerTitleTier[]): Promise<void> {
  const { data: anciens, error: lectureErreur } = await supabase.from("player_title_tiers").select("id");
  if (lectureErreur) throw new Error(lectureErreur.message);
  const { error: insertionErreur } = await supabase.from("player_title_tiers").insert(tiers.map((t) => ({ ...t, updated_at: new Date().toISOString() })));
  if (insertionErreur) throw new Error(insertionErreur.message);
  const ids = anciens.map((r) => r.id);
  if (ids.length === 0) return;
  const { error: retraitErreur } = await supabase.from("player_title_tiers").delete().in("id", ids);
  if (retraitErreur) throw new Error(retraitErreur.message);
}
