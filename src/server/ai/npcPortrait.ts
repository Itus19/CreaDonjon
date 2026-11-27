import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { buildNpcPortraitMessages, npcPortraitSchema, npcPortraitToolSchema, NPC_PORTRAIT_TOOL, type NpcPortrait, type NpcPortraitInput } from "@/src/core/ai/npcPortrait";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

export type DraftNpcPortraitOutcome = { ok: true; portrait: NpcPortrait } | { ok: false; reason: string };

/**
 * V3.2-54 — Un seul aller-retour au modèle pour le portrait d'un PNJ
 * (`generate_npc`, journalisé dans `ai_usage_log` même en cas d'échec par
 * `runAiCompletion`, règle 13). Rien n'est écrit ici : la sortie, validée
 * par Zod, part à `ensureNpcAppearance`, qui l'écrit via `ai_proposals`.
 */
export async function draftNpcPortrait(
  supabase: TypedClient,
  provider: AiProvider,
  params: { userId: string; campaignId: string; input: NpcPortraitInput }
): Promise<DraftNpcPortraitOutcome> {
  const result = await runAiCompletion(
    supabase,
    provider,
    { userId: params.userId, campaignId: params.campaignId, purpose: "generate_npc" },
    {
      messages: buildNpcPortraitMessages(params.input),
      tools: [{ name: NPC_PORTRAIT_TOOL, description: "Décrit l'apparence d'un PNJ", inputSchema: npcPortraitToolSchema }],
      maxOutputTokens: 900,
    }
  );
  const call = result.toolCalls.find((tc) => tc.name === NPC_PORTRAIT_TOOL);
  if (!call) return { ok: false, reason: "aucun appel d'outil" };
  const parsed = npcPortraitSchema.safeParse(call.input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ") };
  return { ok: true, portrait: parsed.data };
}
