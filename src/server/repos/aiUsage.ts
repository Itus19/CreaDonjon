import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Valeurs documentees par SCHEMA.md §16.3 — pas une contrainte CHECK en base, un ensemble ferme cote application. */
export type AiUsagePurpose = "solo_turn" | "generate_npc" | "structure_rule" | "embed" | "summarize";

export interface AiUsageLogEntry {
  userId: string | null;
  campaignId: string | null;
  purpose: AiUsagePurpose;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costMicros: number;
}

/** Ecriture systematique (V1-F1) : "a creer des le premier appel d'API, pas quand la facture surprend" (SCHEMA.md §16.3). */
export async function insertAiUsageLog(supabase: TypedClient, entry: AiUsageLogEntry): Promise<void> {
  const { error } = await supabase.from("ai_usage_log").insert({
    user_id: entry.userId,
    campaign_id: entry.campaignId,
    purpose: entry.purpose,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    cached_tokens: entry.cachedTokens,
    cost_micros: entry.costMicros,
  });
  if (error) throw new Error(error.message);
}

export interface AiUsageWindowStats {
  count: number;
  oldestCreatedAt: string | null;
}

/** Fenetre glissante pour la limite de debit (V1-F1) — index deja pose sur (user_id, created_at desc) par la migration 009. */
export async function getAiUsageWindowStats(
  supabase: TypedClient,
  userId: string,
  sinceIso: string
): Promise<AiUsageWindowStats> {
  const { data, error } = await supabase
    .from("ai_usage_log")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return { count: rows.length, oldestCreatedAt: rows[0]?.created_at ?? null };
}
