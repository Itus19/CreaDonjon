import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { AiProvider, CompletionRequest, CompletionResult } from "./provider";
import { checkAiRateLimit } from "./rateLimit";
import { insertAiUsageLog, type AiUsagePurpose } from "@/src/server/repos/aiUsage";

type TypedClient = SupabaseClient<Database>;

export class AiRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Limite d'appels IA atteinte, reessayez plus tard.");
    this.name = "AiRateLimitError";
  }
}

export interface AiCallContext {
  userId: string;
  campaignId: string | null;
  purpose: AiUsagePurpose;
}

/**
 * Journalise systematiquement dans `ai_usage_log`, meme si `call` echoue —
 * "ai_usage_log ecrit a chaque appel, sans exception" (V1-F1). L'erreur
 * d'origine de `call` est propagee telle quelle apres journalisation, jamais
 * masquee par un `finally` qui renverrait a la place.
 */
async function withAiUsageLogging<T>(
  supabase: TypedClient,
  provider: AiProvider,
  context: AiCallContext,
  tokensOf: (result: T | undefined) => { inputTokens: number; outputTokens: number; cachedTokens: number },
  call: () => Promise<T>
): Promise<T> {
  let result: T | undefined;
  let thrown: unknown;
  try {
    result = await call();
  } catch (err) {
    thrown = err;
  }
  const tokens = tokensOf(result);
  await insertAiUsageLog(supabase, {
    userId: context.userId,
    campaignId: context.campaignId,
    purpose: context.purpose,
    model: provider.model,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cachedTokens: tokens.cachedTokens,
    costMicros: 0,
  });
  if (thrown !== undefined) throw thrown;
  return result as T;
}

/**
 * Point de passage oblige pour toute completion (V1-F1). Aucun code hors de
 * `src/server/ai/` ne doit appeler `AiProvider.complete` directement
 * (CLAUDE.md regle 16 ter) : cette fonction verifie la limite de debit puis
 * journalise, que l'appel reussisse ou non.
 */
export async function runAiCompletion(
  supabase: TypedClient,
  provider: AiProvider,
  context: AiCallContext,
  request: CompletionRequest,
  limit?: number
): Promise<CompletionResult> {
  const decision = await checkAiRateLimit(supabase, context.userId, limit);
  if (!decision.allowed) throw new AiRateLimitError(decision.retryAfterMs ?? 0);

  return withAiUsageLogging(
    supabase,
    provider,
    context,
    (result) => ({
      inputTokens: result?.inputTokens ?? 0,
      outputTokens: result?.outputTokens ?? 0,
      cachedTokens: result?.cachedTokens ?? 0,
    }),
    () => provider.complete(request)
  );
}

/** Meme garde-fous que `runAiCompletion`, pour les embeddings (V1-F1). */
export async function runAiEmbedding(
  supabase: TypedClient,
  provider: AiProvider,
  context: AiCallContext,
  texts: string[],
  limit?: number
): Promise<number[][]> {
  const decision = await checkAiRateLimit(supabase, context.userId, limit);
  if (!decision.allowed) throw new AiRateLimitError(decision.retryAfterMs ?? 0);

  return withAiUsageLogging(
    supabase,
    provider,
    context,
    () => ({ inputTokens: 0, outputTokens: 0, cachedTokens: 0 }),
    () => provider.embed(texts)
  );
}
