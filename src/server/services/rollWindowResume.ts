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
import { answerSaveRequest, type AnswerSaveRequestResult } from "@/src/server/services/saveRequests";
import { rollAbilityCheck, rollSavingThrow, rollSkillCheck, type CheckRollResult } from "@/src/server/services/checkRolls";
import { answerSaveRequestSchema } from "@/lib/saveRequests/schemas";
import { ABILITIES } from "@/src/core/rules/abilities";
import { SKILLS } from "@/src/core/rules/sheet";
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

/** Le jet repris, selon son origine : le résultat du service d'origine, rejoué avec le jet modifié. */
export type ResumedRoll =
  | { origin: "targeted"; result: TargetedRollResult }
  | { origin: "save_request"; result: AnswerSaveRequestResult }
  | { origin: "sheet_check"; result: CheckRollResult };

export type RollWindowAnswerResult =
  | { ok: true; closed: boolean; resumed: ResumedRoll | null }
  | { ok: false; reason: "refused" | "not_found" };

const zAnswers = z.record(z.string(), z.object({ use: z.boolean() }).passthrough());

const zResumeTargeted = z.object({
  input: targetedRollSchema.and(z.object({ damageToken: z.string().optional() })),
  callerIsGm: z.boolean(),
  preset: z.object({ label: z.string(), expression: z.string(), critRange: z.number().int() }).optional(),
  damageType: z.string().nullable().optional(),
});
const zResumeSave = z.object({ requestId: z.string().uuid(), input: answerSaveRequestSchema });
const zResumeCheck = z.object({
  replay: z.discriminatedUnion("fn", [
    z.object({ fn: z.literal("ability"), ability: z.enum(ABILITIES) }),
    z.object({ fn: z.literal("skill"), skill: z.enum(SKILLS) }),
    z.object({ fn: z.literal("save"), ability: z.enum(ABILITIES) }),
  ]),
  params: z.object({
    entityId: z.string().uuid(),
    campaignId: z.string().uuid().nullable(),
    callerId: z.string().uuid(),
    advantage: z.enum(["normal", "advantage", "disadvantage"]),
    dc: z.number().int().nullable(),
    hidden: z.boolean(),
    dcPrivate: z.boolean().optional(),
    reroll: z.boolean().optional(),
    locale: z.enum(["fr", "en"]),
  }),
});

async function resumeIfAuthor(supabase: TypedClient, closed: RollWindowRow | null, params: { callerId: string; locale: Locale }): Promise<ResumedRoll | null> {
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
export async function resumeRollWindow(supabase: TypedClient, params: { windowId: string; campaignId: string; callerId: string; locale: Locale }): Promise<ResumedRoll> {
  const row = await getRollWindow(supabase, params.windowId);
  if (!row) throw new Error("Fenêtre de réaction introuvable.");
  const state = zRollWindowState.parse(await resumeRollWindowState(supabase, { campaignId: params.campaignId, windowId: params.windowId }));
  const answers = zAnswers.parse(row.answers);
  // Qui joue les réactions : l'auteur, avec ses droits (MJ : écriture directe ; joueuse : signée sur ce qui n'est pas à elle).
  const authorIsGm =
    state.origin === "targeted" ? zResumeTargeted.parse(state.resume).callerIsGm : state.origin === "sheet_check" ? row.choices !== null && zChoicesGm(row.choices) : false;

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
      callerIsGm: authorIsGm,
      locale: params.locale,
      // La réaction se compte à part (ADR 0075) ; un sort de réaction dépense son emplacement (ADR 0076).
      skipBudget: true,
      ...(c.spellSlot ? { spell: { slotLevel: c.spellSlot } } : {}),
    });
    if (!played.ok) continue;
    used.push(c);
    // Le compte : réaction datée, usage « une fois par tour ».
    if (c.participantId && state.stamp && (c.reaction || c.limitKey)) {
      const usage = recordUse(c.usage, { key: c.limitKey, reaction: c.reaction, stamp: state.stamp });
      if (authorIsGm) await updateCombatParticipant(supabase, c.participantId, { turnUsage: usage as unknown as Json });
      else await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: [{ kind: "turn_usage", id: c.participantId, turn_usage: usage }] });
    }
  }

  const { roll } = applyRollOperations(state.roll, used.map((c) => ({ actorId: c.actorId, operations: c.operations, numbers: c.numbers })), serverRng);
  const preset = { natural: roll.natural, total: roll.total };

  if (state.origin === "save_request") {
    const r = zResumeSave.parse(state.resume);
    return { origin: "save_request", result: await answerSaveRequest(supabase, { campaignId: params.campaignId, requestId: r.requestId, callerId: params.callerId, locale: params.locale, input: r.input, preset }) };
  }
  if (state.origin === "sheet_check") {
    const r = zResumeCheck.parse(state.resume);
    const base = { ...r.params, callerId: params.callerId, preset };
    const result =
      r.replay.fn === "ability"
        ? await rollAbilityCheck(supabase, { ...base, ability: r.replay.ability })
        : r.replay.fn === "skill"
          ? await rollSkillCheck(supabase, { ...base, skill: r.replay.skill })
          : await rollSavingThrow(supabase, { ...base, ability: r.replay.ability });
    return { origin: "sheet_check", result };
  }

  const resume = zResumeTargeted.parse(state.resume);
  if (!state.combatId) throw new Error("Une fenêtre de jet ciblé appartient à un combat.");
  const result = await resolveTargetedRoll(supabase, {
    campaignId: params.campaignId,
    combatId: state.combatId,
    callerId: params.callerId,
    locale: params.locale,
    input: resume.input,
    callerIsGm: resume.callerIsGm,
    preset:
      roll.kind === "damage"
        ? { damage: { total: roll.total, ...(resume.damageType ? { type: resume.damageType } : {}) } }
        : {
            attack: {
              total: roll.total,
              natural: roll.natural ?? 0,
              critRange: roll.critRange,
              acBonus: roll.acBonus,
              label: resume.preset?.label ?? "",
              expression: resume.preset?.expression ?? "1d20",
              ...(roll.forcedMiss ? { forcedMiss: true } : {}),
            },
          },
  });
  return { origin: "targeted", result };
}

/** Un jet de la fiche lancé par le MJ : ses lignes de fenêtre lui reviennent (user_id null). */
function zChoicesGm(choices: Json): boolean {
  return Array.isArray(choices) && choices.every((c) => c !== null && typeof c === "object" && !Array.isArray(c) && (c as { user_id?: unknown }).user_id === null);
}
