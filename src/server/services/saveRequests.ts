import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { resolveCheckRoll } from "@/src/core/rules/action";
import { effectsForSaveOutcome, saveTotal, zSaveRequestEffect } from "@/src/core/rules/saveRequest";
import { parseFormula } from "@/src/core/formula";
import {
  answerSaveRequestRow,
  getSaveRequestById,
  listPendingSaveRequests,
  setOwnParticipantVitals,
  type SaveRequestRow,
} from "@/src/server/repos/saveRequests";
import { getCombatById, getCombatParticipantById } from "@/src/server/repos/combats";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { getCampaign } from "@/src/server/services/campaigns";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { journalCombatEvent } from "@/src/server/services/combats";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { applyResolvedEffects, targetSaveBonus } from "@/src/server/services/targetedRoll";
import { serverRng } from "@/src/server/services/rng";
import type { AnswerSaveRequestInput } from "@/lib/saveRequests/schemas";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-111 (ADR 0044) — la réponse à une sauvegarde demandée.
 *
 * Traitée **au nom de celui qui répond** :
 * - le joueur de la cible applique l'issue sur SON PJ — son état de jeu
 *   (qu'il peut déjà écrire), puis sa ligne de combat par
 *   `set_own_participant_vitals` (fermée aux joueurs depuis V3.1-101) ;
 * - le MJ l'applique par le cœur commun (`applyResolvedEffects`), comme
 *   n'importe quel coup.
 * Aucun dé n'est relancé pour les dégâts : ils ont été lancés à la demande et
 * figés dans `effect`. La réponse ne choisit que l'issue.
 */

export type SaveRequestView = Pick<
  SaveRequestRow,
  "id" | "label" | "ability" | "dc" | "status" | "target_id" | "target_entity_id" | "target_user_id" | "created_at"
>;

export async function listMyPendingSaveRequests(supabase: TypedClient, campaignId: string): Promise<SaveRequestView[]> {
  const rows = await listPendingSaveRequests(supabase, campaignId);
  return rows.map(({ id, label, ability, dc, status, target_id, target_entity_id, target_user_id, created_at }) => ({
    id,
    label,
    ability,
    dc,
    status,
    target_id,
    target_entity_id,
    target_user_id,
    created_at,
  }));
}

export type AnswerSaveRequestResult =
  | { ok: true; passed: boolean; natural: number | null; total: number; changes: string[]; hints: string[]; ignored: string[] }
  | { ok: false; reason: "not_found" | "not_pending" | "invalid_effect" | "no_target" | "refused" };

export async function answerSaveRequest(
  supabase: TypedClient,
  params: { campaignId: string; requestId: string; callerId: string; locale: Locale; input: AnswerSaveRequestInput }
): Promise<AnswerSaveRequestResult> {
  const request = await getSaveRequestById(supabase, params.requestId);
  if (!request || request.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (request.status !== "pending") return { ok: false, reason: "not_pending" };
  const effect = zSaveRequestEffect.safeParse(request.effect);
  if (!effect.success) return { ok: false, reason: "invalid_effect" };

  const campaign = await getCampaign(supabase, request.campaign_id);
  if (!campaign) return { ok: false, reason: "not_found" };
  const answeringAsTarget = request.target_user_id !== null && request.target_user_id === params.callerId;

  // Le bonus de sauvegarde : la fiche du PJ pour son joueur ; sinon (le MJ)
  // la cible telle que le combat la porte (fiche, bloc de stats, ou 0).
  const ctx =
    answeringAsTarget && request.target_entity_id
      ? await resolveCharacterActionContext(supabase, request.target_entity_id, request.campaign_id, params.locale)
      : null;
  let bonus: number;
  const hints: string[] = [];
  if (answeringAsTarget) {
    if (!ctx) return { ok: false, reason: "no_target" };
    bonus = ctx.sheet.savingThrows[request.ability as keyof typeof ctx.sheet.savingThrows]?.mod ?? 0;
  } else {
    const participant = request.target_kind === "participant" ? await getCombatParticipantById(supabase, request.target_id) : null;
    if (!participant) return { ok: false, reason: "no_target" };
    const found = await targetSaveBonus(supabase, {
      target: participant,
      isPc: request.target_user_id !== null,
      ability: request.ability,
      campaignId: request.campaign_id,
      rulesetId: campaign.rulesetId,
      locale: params.locale,
    });
    bonus = found.bonus;
    if (found.hint) hints.push(found.hint);
  }

  // Lancer par le serveur (règle 8), ou le vrai dé de la table.
  let natural: number | null;
  let total: number;
  let expression: string;
  let ast: unknown;
  let trace: Json;
  if (params.input.mode === "roll") {
    const roll = resolveCheckRoll({ modifier: bonus, advantage: "normal" }, serverRng);
    natural = roll.trace[0]?.value ?? null;
    total = roll.total;
    expression = roll.expression;
    ast = roll.ast;
    trace = roll.trace as unknown as Json;
  } else {
    ({ natural, total } = saveTotal(params.input, bonus));
    expression = params.input.modifierIncluded ? `${total} (annoncé, modificateur inclus)` : `${natural} (annoncé) + ${bonus}`;
    ast = parseFormula(String(Math.max(0, total)));
    trace = [{ text: "annoncé", value: params.input.natural }] as unknown as Json;
  }

  // La réponse, d'abord : la fonction refuse un autre compte, une demande
  // déjà répondue ou annulée — rien d'autre n'est écrit avant.
  const answered = await answerSaveRequestRow(supabase, { requestId: request.id, natural, total });
  if (!answered) return { ok: false, reason: "refused" };
  const passed = total >= request.dc;

  const sessionId = await getOrOpenSessionForCampaign(supabase, request.campaign_id);
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId: request.campaign_id,
    expression,
    ast: ast as Json,
    context: { modifier: bonus } as unknown as Json,
    result: total,
    detail: { who: request.label, what: `Sauvegarde ${request.ability.toUpperCase()}`, dc: request.dc, verdict: passed ? "success" : "fail", trace } as unknown as Json,
    rolledBy: answeringAsTarget ? "player" : "gm",
    visibilityLevel: "public",
    attribution: {
      entityId: request.target_entity_id,
      kind: "save",
      ...(natural !== null ? { naturalD20: natural } : {}),
    },
  });

  const seq = await nextEventSeq(supabase, sessionId);
  const saveEvent = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "roll",
    actor: answeringAsTarget ? "player" : "gm",
    actorUserId: params.callerId,
    payload: {
      __v: 1,
      save_request: { id: request.id, origin_roll_id: request.origin_roll_id, label: request.label, ability: request.ability, dc: request.dc, natural, total, passed },
      facts: [`${request.label} : ${total} — ${passed ? "réussie" : "ratée"}.`],
    } as unknown as Json,
  });

  const note = `Sauvegarde — ${request.label}`;
  if (answeringAsTarget && ctx && request.target_entity_id) {
    // Le joueur, sur SON PJ : l'état de jeu par le cœur commun…
    const outcome = await applyResolvedEffects(supabase, {
      campaignId: request.campaign_id,
      callerId: params.callerId,
      actor: { entityId: request.target_entity_id, name: ctx.entityName, hpMax: ctx.sheet.hitPoints.max, speed: ctx.sheet.speed.value },
      scene: null,
      spend: null,
      effects: effectsForSaveOutcome(effect.data, passed, request.target_entity_id),
      note,
      fromEventId: saveEvent.id,
      combatId: null,
    });
    // … puis sa ligne de combat, recopiée, journalisée et annulable par le MJ.
    const after = outcome.applied.state.actors[request.target_entity_id];
    if (request.target_kind === "participant" && after && outcome.changes.length > 0) {
      const written = await setOwnParticipantVitals(supabase, {
        participantId: request.target_id,
        hpCurrent: after.hp.current,
        tempHp: after.hp.temp,
        conditions: after.conditions,
      });
      const combat = request.combat_id ? await getCombatById(supabase, request.combat_id) : null;
      if (written && combat) {
        await journalCombatEvent(supabase, combat, {
          target: "participant",
          targetId: request.target_id,
          before: written.before,
          after: written.after,
          note,
          actorUserId: params.callerId,
          actor: "player",
        });
      }
    }
    return { ok: true, passed, natural, total, changes: outcome.changes, hints: [...hints, ...outcome.hints], ignored: outcome.ignored };
  }

  // Le MJ : la cible telle que le combat la porte, par le cœur commun.
  const outcome = await applyResolvedEffects(supabase, {
    campaignId: request.campaign_id,
    callerId: params.callerId,
    actor: null,
    scene: null,
    spend: null,
    effects: effectsForSaveOutcome(effect.data, passed, `participant:${request.target_id}`),
    note,
    fromEventId: saveEvent.id,
    combatId: request.combat_id,
  });
  return { ok: true, passed, natural, total, changes: outcome.changes, hints: [...hints, ...outcome.hints], ignored: outcome.ignored };
}
