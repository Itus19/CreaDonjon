import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface DiceRollRow {
  id: string;
  session_id: string | null;
  campaign_id: string;
  expression: string;
  result: number;
  created_at: string;
}

/** Un jet ecrit par un bouton de la fiche jouable (V1-B5) : jamais par un modele d'IA (SCHEMA.md §14). */
export async function insertDiceRoll(
  supabase: TypedClient,
  params: {
    sessionId: string | null;
    campaignId: string;
    expression: string;
    ast: Json;
    context: Json;
    result: number;
    detail: Json;
    rolledBy: "player" | "gm" | "ai" | "system";
  }
): Promise<DiceRollRow> {
  const { data, error } = await supabase
    .from("dice_rolls")
    .insert({
      session_id: params.sessionId,
      campaign_id: params.campaignId,
      expression: params.expression,
      ast: params.ast,
      context: params.context,
      result: params.result,
      detail: params.detail,
      rolled_by: params.rolledBy,
    })
    .select("id, session_id, campaign_id, expression, result, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
