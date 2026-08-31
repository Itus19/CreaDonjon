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
  detail: Json;
  rolled_by: string;
  visibility_level: string;
  created_at: string;
}

const DICE_ROLL_COLUMNS = "id, session_id, campaign_id, expression, result, detail, rolled_by, visibility_level, created_at";

/** Un jet ecrit par un bouton de la fiche jouable (V1-B5) ou le volet de lancer de des (V2-M11) : jamais par un modele d'IA (SCHEMA.md §14). */
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
    /** 'gm' reserve au MJ (RLS `dice_rolls_write` le refuse sinon) — voir `visibility_level`, SCHEMA.md. */
    visibilityLevel: "public" | "gm";
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
      visibility_level: params.visibilityLevel,
    })
    .select(DICE_ROLL_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Historique d'une campagne pour le volet (onglet Historique, V2-M11) — la RLS `dice_rolls_select` filtre deja les jets `gm` pour un simple joueur, jamais un second filtre ici. */
export async function listDiceRollsForCampaign(
  supabase: TypedClient,
  params: { campaignId: string; limit: number }
): Promise<DiceRollRow[]> {
  const { data, error } = await supabase
    .from("dice_rolls")
    .select(DICE_ROLL_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .order("created_at", { ascending: false })
    .limit(params.limit);
  if (error) throw new Error(error.message);
  return data;
}
