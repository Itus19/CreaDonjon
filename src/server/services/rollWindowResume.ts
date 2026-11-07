import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { applyRollOperations, recordUse } from "@/src/core/rules/rollWindow";
import { targetedRollSchema } from "@/lib/combats/schemas";
import { answerRollWindowRow, closeRollWindowRow, getRollWindow, type RollWindowRow } from "@/src/server/repos/rollWindows";
import { updateCombatParticipant } from "@/src/server/repos/combats";
import { applySignedEngineChange, resumeRollWindowState } from "@/src/server/services/engineSigning";
import { activateFeature } from "@/src/server/services/featureActivation";
import { resolveTargetedRoll, type TargetedRollResult } from "@/src/server/services/targetedRoll";
import { zRollWindowState } from "@/src/server/services/rollWindows";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-160 (ADR 0075) — répondre à une fenêtre de réaction, et la reprendre.
 *
 * Chacun n'écrit que sa réponse. Quand la fenêtre se ferme (tout le monde a
 * répondu, ou « Continuer » du MJ), l'AUTEUR du jet la reprend avec ses
 * droits d'aujourd'hui : chaque réaction utilisée est jouée comme une
 * activation (coûts, ressources, effets, journal), ses opérations modifient
 * le jet, la réaction et la limite sont comptées, puis la résolution
 * d'origine est rejouée avec le jet modifié, sans relancer aucun dé.
 */

export type RollWindowAnswerResult =
  | { ok: true; closed: boolean; resumed: TargetedRollResult | null }
  | { ok: false; reason: "refused" | "not_found" };

const zAnswers = z.record(z.string(), z.object({ use: z.boolean() }).passthrough());

const zResume = z.object({
  input: targetedRollSchema.and(z.object({ damageToken: z.string().optional() })),
  callerIsGm: z.boolean(),
  preset: z.object({ label: z.string(), expression: z.string(), critRange: z.number().int() }).optional(),
  damageType: z.string().nullable().optional(),
});

async function resumeIfAuthor(supabase: TypedClient, closed: RollWindowRow | null, params: { callerId: string; locale: Locale }): Promise<TargetedRollResult | null> {
  if (!closed || closed.author_user_id !== params.callerId) return null;
  return resumeRollWindow(supabase, { windowId: closed.id, campaignId: closed.campaign_id, callerId: params.callerId, locale: params.locale });
}

/** Répondre « utiliser » ou « passer » ; ferme la fenêtre si c'était la dernière réponse, et la reprend si l'appelant en est l'auteur. */
export async function answerRollWindow(
  supabase: TypedClient,
  params: { windowId: string; index: number; use: boolean; callerId: string; locale: Locale },
): Promise<RollWindowAnswerResult> {
  const answered = await answerRollWindowRow(supabase, { windowId: params.windowId, index: params.index, use: params.use });
  if (!answered) return { ok: false, reason: "refused" };
  const closed = await closeRollWindowRow(supabase, params.windowId);
  return { ok: true, closed: closed !== null, resumed: await resumeIfAuthor(supabase, closed, params) };
}

/** « Continuer » (le MJ) : les réponses manquantes valent « passer ». */
export async function continueRollWindow(supabase: TypedClient, params: { windowId: string; callerId: string; locale: Locale }): Promise<RollWindowAnswerResult> {
  const before = await getRollWindow(supabase, params.windowId);
  if (!before) return { ok: false, reason: "not_found" };
  const closed = await closeRollWindowRow(supabase, params.windowId);
  if (!closed) return { ok: false, reason: "refused" };
  return { ok: true, closed: true, resumed: await resumeIfAuthor(supabase, closed, params) };
}

/** La reprise : réservée à l'auteur (la base le vérifie), une seule fois. */
export async function resumeRollWindow(supabase: TypedClient, params: { windowId: string; campaignId: string; callerId: string; locale: Locale }): Promise<TargetedRollResult> {
  const row = await getRollWindow(supabase, params.windowId);
  if (!row) throw new Error("Fenêtre de réaction introuvable.");
  const state = zRollWindowState.parse(await resumeRollWindowState(supabase, { campaignId: params.campaignId, windowId: params.windowId }));
  const resume = zResume.parse(state.resume);
  const answers = zAnswers.parse(row.answers);

  // Les réactions utilisées, dans l'ordre de la fenêtre (auteur, cible, autres).
  const used = [];
  for (const [i, c] of state.choices.entries()) {
    if (answers[String(i)]?.use !== true) continue;
    // Jouée comme une activation : coûts, ressources, effets, journal. Un refus (ressource épuisée entre-temps) l'écarte.
    const played = await activateFeature(supabase, {
      entityId: c.actorId,
      campaignId: params.campaignId,
      ruleKey: c.ruleKey,
      activationId: c.activationId,
      variantId: null,
      targetParticipantIds: [],
      callerId: params.callerId,
      callerIsGm: resume.callerIsGm,
      locale: params.locale,
    });
    if (!played.ok) continue;
    used.push(c);
    // Le compte : réaction datée, usage « une fois par tour ».
    if (c.participantId && state.stamp && (c.reaction || c.limitKey)) {
      const usage = recordUse(c.usage, { key: c.limitKey, reaction: c.reaction, stamp: state.stamp });
      if (resume.callerIsGm) await updateCombatParticipant(supabase, c.participantId, { turnUsage: usage as unknown as Json });
      else await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: [{ kind: "turn_usage", id: c.participantId, turn_usage: usage }] });
    }
  }

  const { roll } = applyRollOperations(state.roll, used.map((c) => ({ actorId: c.actorId, operations: c.operations, numbers: c.numbers })), serverRng);
  if (!state.combatId) throw new Error("Une fenêtre de jet ciblé appartient à un combat.");
  return resolveTargetedRoll(supabase, {
    campaignId: params.campaignId,
    combatId: state.combatId,
    callerId: params.callerId,
    locale: params.locale,
    input: resume.input,
    callerIsGm: resume.callerIsGm,
    preset:
      roll.kind === "damage"
        ? { damage: { total: roll.total, ...(resume.damageType ? { type: resume.damageType } : {}) } }
        : { attack: { total: roll.total, natural: roll.natural ?? 0, critRange: roll.critRange, acBonus: roll.acBonus, label: resume.preset?.label ?? "", expression: resume.preset?.expression ?? "1d20" } },
  });
}
