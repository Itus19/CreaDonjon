import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { decideRateLimit, type RateLimitDecision } from "@/src/core/ai/rateLimit";
import { getAiUsageWindowStats } from "@/src/server/repos/aiUsage";

type TypedClient = SupabaseClient<Database>;

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = 30;

/** Limite de debit par utilisateur sur les routes IA (V1-F1) : fenetre glissante d'une heure sur `ai_usage_log`. */
export async function checkAiRateLimit(
  supabase: TypedClient,
  userId: string,
  limit: number = DEFAULT_LIMIT
): Promise<RateLimitDecision> {
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const stats = await getAiUsageWindowStats(supabase, userId, sinceIso);
  const oldestCallAgeMs = stats.oldestCreatedAt ? Date.now() - new Date(stats.oldestCreatedAt).getTime() : undefined;
  return decideRateLimit({ countInWindow: stats.count, limit, windowMs: WINDOW_MS, oldestCallAgeMs });
}
