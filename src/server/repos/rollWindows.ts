import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-160 (ADR 0075) — la partie lisible des fenêtres de réaction. On ne les
 * écrit jamais directement : ouverture et reprise signées
 * (`engineChanges.ts`), réponse et fermeture par fonctions.
 */
export type RollWindowRow = Database["public"]["Tables"]["roll_windows"]["Row"];

const COLUMNS = "id, campaign_id, combat_id, author_user_id, kind, label, view, choices, answers, status, created_at, closed_at, resumed_at";

export async function getRollWindow(supabase: TypedClient, id: string): Promise<RollWindowRow | null> {
  const { data, error } = await supabase.from("roll_windows").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Les fenêtres ouvertes de la campagne que l'appelant voit (RLS : auteur, répondants, MJ). */
export async function listPendingRollWindows(supabase: TypedClient, campaignId: string): Promise<RollWindowRow[]> {
  const { data, error } = await supabase.from("roll_windows").select(COLUMNS).eq("campaign_id", campaignId).eq("status", "pending").order("created_at", { ascending: true }).limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Sa propre réponse ; `null` si refusée (pas la bonne personne, déjà répondue, fermée). */
export async function answerRollWindowRow(supabase: TypedClient, params: { windowId: string; index: number; use: boolean }): Promise<RollWindowRow | null> {
  const { data, error } = await supabase.rpc("answer_roll_window", { p_window: params.windowId, p_index: params.index, p_use: params.use });
  if (error) throw new Error(error.message);
  return (data as RollWindowRow | null) ?? null;
}

/** Ferme si tout le monde a répondu (ou si l'appelant est le MJ) ; `null` sinon. */
export async function closeRollWindowRow(supabase: TypedClient, windowId: string): Promise<RollWindowRow | null> {
  const { data, error } = await supabase.rpc("close_roll_window", { p_window: windowId });
  if (error) throw new Error(error.message);
  return (data as RollWindowRow | null) ?? null;
}
