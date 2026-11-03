import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { planActivation, type ActivationRefusal } from "@/src/core/rules/activation";
import { effectToRow, type ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import type { EffectNode, ResolvedEffect, TriggerActorState, TriggerContext } from "@/src/core/rules/triggers";
import { ABILITIES } from "@/src/core/rules/abilities";
import { zActivationBlockData, type ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { orderParticipants } from "@/src/server/services/combats";
import { getActiveCombatForCampaign, listCombatParticipants, type CombatParticipantRow } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { insertFeatureEffect } from "@/src/server/repos/activeEffects";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { resolveEntryBlocksInRuleset } from "@/src/server/services/rules";
import { getCampaign } from "@/src/server/services/campaigns";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { setConcentration } from "@/src/server/services/concentration";
import { applySignedEngineChange, readCombatParticipantsSigned, type EngineChangeLine } from "@/src/server/services/engineSigning";
import { applyResolvedEffects, targetSaveBonus } from "@/src/server/services/targetedRoll";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-130 (ADR 0060 §5, ADR 0073) — jouer une règle : le service autour de
 * `planActivation`.
 *
 * L'entrée est déjà validée (Zod, route) et le droit d'écrire la fiche vérifié
 * (`canEditEntity`, route). Ici : la règle doit être une aptitude DE CE
 * personnage ; le noyau vérifie prérequis, ressources et cibles, LANCE LES DÉS
 * (le serveur, règle absolue 8) et rend un plan, que ce service applique :
 * usages consommés (état de jeu), effets immédiats et états (par
 * `applyResolvedEffects` : direct pour le MJ, signé pour un joueur sur ce qui
 * n'est pas à lui), effets qui durent (`entity_active_effects`, par instance
 * de combat ou par PJ), concentration. Un refus n'écrit rien.
 *
 * Les acteurs portent les clés de `applyResolvedEffects` : le personnage par
 * son entité, chaque participant par `participant:<id>`.
 */

export type ActivateFeatureFailure =
  | ActivationRefusal
  | "not_found"
  | "feature_not_owned"
  | "no_activation_block"
  | "no_combat"
  | "target_not_found";

export interface ActivateFeatureSuccess {
  ok: true;
  /** Ce qui s'est passé, en phrases (le journal en reçoit la version des joueurs). */
  changes: string[];
  /** Les effets qui durent posés, par porteur. */
  applied: { bearer: string; label: string }[];
  /** Usages consommés après l'activation. */
  used: Record<string, number>;
}

/** Les caractéristiques qu'une liste d'effets fait sauvegarder (branches comprises), pour ne lire que ces bonus-là. */
function savedAbilities(effects: readonly EffectNode[]): string[] {
  return [
    ...new Set(
      effects.flatMap((e) =>
        e.action === "saving_throw" ? [e.ability.toLowerCase(), ...savedAbilities(e.on_fail ?? []), ...savedAbilities(e.on_pass ?? [])] : []
      )
    ),
  ];
}

export async function activateFeature(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    ruleKey: string;
    activationId: string;
    variantId: string | null;
    /** Participants du combat en cours visés (sans préfixe). Vide : sur soi, ou sans cible. */
    targetParticipantIds: readonly string[];
    callerId: string;
    /** Le MJ écrit directement ; un joueur écrit par changement signé ce qui n'est pas à lui (ADR 0041). */
    callerIsGm: boolean;
    locale: Locale;
  }
): Promise<ActivateFeatureSuccess | { ok: false; reason: ActivateFeatureFailure; detail?: string }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };
  // Une règle ne se joue que si le personnage la possède : jamais par sa seule clé.
  if (!ctx.sheet.features.some((f) => f.key === params.ruleKey)) return { ok: false, reason: "feature_not_owned" };

  const resolved = await resolveEntryBlocksInRuleset(supabase, ctx.rulesetId, params.ruleKey);
  const lu = zActivationBlockData.safeParse(resolved?.blocksByType.get("activation"));
  if (!lu.success) return { ok: false, reason: "no_activation_block" };
  const block: ActivationBlockData = lu.data;
  const activation = block.activations.find((a) => a.id === params.activationId);
  if (!activation) return { ok: false, reason: "unknown_activation" };
  const variant = params.variantId ? activation.variants?.find((v) => v.id === params.variantId) : undefined;
  const effectNodes = variant ? variant.effects : activation.effects;

  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };

  // Le combat en cours : seulement s'il y a des cibles à y lire.
  let combatId: string | null = null;
  let participants: CombatParticipantRow[] = [];
  let round: number | null = null;
  let currentTurn: string | null = null;
  if (params.targetParticipantIds.length > 0) {
    const combat = await getActiveCombatForCampaign(supabase, params.campaignId);
    if (!combat || combat.status !== "running") return { ok: false, reason: "no_combat" };
    combatId = combat.id;
    round = combat.round;
    // V3.1-107 (ADR 0069) : un joueur ne lit pas les participants ; le moteur les lit par une demande signée.
    participants = params.callerIsGm ? await listCombatParticipants(supabase, combat.id) : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: combat.id });
    const enCours = orderParticipants(participants)[combat.turn_index];
    currentTurn = enCours ? (enCours.entity_id === params.entityId ? params.entityId : `participant:${enCours.id}`) : null;
  }
  const absente = params.targetParticipantIds.find((id) => !participants.some((p) => p.id === id));
  if (absente) return { ok: false, reason: "target_not_found", detail: absente };

  const pcEntityIds = new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id));
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);

  // Les nombres de celui qui active : ce que ses formules lisent.
  const sheet = ctx.sheet;
  const actorNumbers: Record<string, number> = {
    level: ctx.characterData.classes.reduce((s, c) => s + c.level, 0),
    proficiency: sheet.proficiencyBonus,
    ...(sheet.spellcasting ? { spell_save_dc: sheet.spellcasting.saveDc } : {}),
  };
  for (const a of ABILITIES) {
    actorNumbers[`ability.${a}`] = sheet.abilities[a].mod;
    actorNumbers[`save.${a}`] = sheet.savingThrows[a].mod;
  }
  const actors: Record<string, TriggerActorState> = {
    [params.entityId]: { conditions: [...state.conditions], features: sheet.features.map((f) => f.key), numbers: actorNumbers },
  };
  const abilities = savedAbilities(effectNodes);
  for (const id of params.targetParticipantIds) {
    const p = participants.find((x) => x.id === id)!;
    const isPc = p.entity_id !== null && pcEntityIds.has(p.entity_id);
    const numbers: Record<string, number> = {};
    for (const ability of abilities) {
      numbers[`save.${ability}`] = (await targetSaveBonus(supabase, { target: p, isPc, ability, campaignId: params.campaignId, worldId: campaign.worldId, locale: params.locale })).bonus;
    }
    actors[`participant:${id}`] = {
      conditions: Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [],
      features: [],
      numbers,
    };
  }
  const sceneCtx: TriggerContext = { actors };

  const plan = planActivation({
    block,
    activationId: params.activationId,
    variantId: params.variantId,
    actorId: params.entityId,
    targetIds: params.targetParticipantIds.map((id) => `participant:${id}`),
    ctx: sceneCtx,
    resources: sheet.resources,
    used: state.resources,
    // Le budget d'action de la table n'est pas tenu en base : le moteur ne le paie pas ici (la boucle du solo le tient).
    budget: null,
    currentTurn,
    round,
    rng: serverRng,
    locale: params.locale,
  });
  if (!plan.ok) return { ok: false, reason: plan.reason, ...(plan.detail ? { detail: plan.detail } : {}) };

  const label = activation.label[params.locale] ?? activation.label.fr ?? activation.id;
  const note = `Activation — ${label} (${ctx.entityName})`;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);

  // 1. Les usages : l'état de jeu du personnage, le sien (droit vérifié par la route).
  if (plan.plan.spend.length > 0) {
    await applyRuntimeStateChange(supabase, {
      entityId: params.entityId,
      campaignId: params.campaignId,
      patch: { resources: plan.plan.used },
      note: `${note} : ${plan.plan.spend.map((s) => `${s.key} −${s.amount}`).join(", ")}`,
      sessionId,
      actor: "player",
      actorUserId: params.callerId,
    });
  }

  // 2. Les effets immédiats, et les états que posent les effets qui durent.
  const etats: ResolvedEffect[] = plan.plan.applied.flatMap((a) => a.conditions.map((key) => ({ action: "apply_condition" as const, who: a.bearer, key })));
  const outcome = await applyResolvedEffects(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    actor: { entityId: params.entityId, name: ctx.entityName, hpMax: sheet.hitPoints.max, speed: sheet.speed.value },
    scene: null,
    spend: null,
    effects: [...plan.plan.effects.filter((e) => e.action !== "apply_effect"), ...etats],
    note,
    fromEventId: null,
    combatId,
    participants,
    ...(params.callerIsGm ? { gmJournal: true } : { signedWrites: { ownEntityIds: new Set([params.entityId]) } }),
  });

  // 3. Les effets qui durent : par PJ (son entité) ou par instance de combat (ADR 0073).
  const signes: EngineChangeLine[] = [];
  for (const effet of plan.plan.applied) {
    const porteur = bearerOf(effet, participants, pcEntityIds);
    const ligne = effectToRow(effet, params.ruleKey);
    const ecritDirect = params.callerIsGm || ("entityId" in porteur && porteur.entityId === params.entityId);
    if (ecritDirect) {
      await insertFeatureEffect(supabase, {
        campaignId: params.campaignId,
        bearer: porteur,
        label: ligne.label,
        sourceKey: ligne.source_key,
        modifiers: ligne.modifiers as unknown as Json,
        duration: ligne.duration as unknown as Json,
        payload: ligne.payload as unknown as Json,
      });
    } else {
      signes.push({
        kind: "effect_add",
        id: "entityId" in porteur ? porteur.entityId : porteur.participantId,
        bearer: "entityId" in porteur ? "entity" : "participant",
        effect: { label: ligne.label, source_key: ligne.source_key, modifiers: ligne.modifiers, duration: ligne.duration, payload: ligne.payload },
      });
    }
  }
  if (signes.length > 0) await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: signes });

  // 4. La concentration : un effet qui en dépend la pose (la précédente est rompue, V3.1-24).
  if (plan.plan.applied.some((a) => a.concentration)) {
    await setConcentration(supabase, { entityId: params.entityId, campaignId: params.campaignId, incoming: { spell_key: null, label }, actorUserId: params.callerId });
  }

  return {
    ok: true,
    changes: outcome.changes,
    applied: plan.plan.applied.map((a) => ({ bearer: a.bearer, label: a.label })),
    used: plan.plan.used,
  };
}

/** Le porteur EN BASE d'un effet : le personnage qui active, un PJ du combat par son entité, toute autre instance par elle-même. */
function bearerOf(
  effet: ActiveDurableEffect,
  participants: readonly CombatParticipantRow[],
  pcEntityIds: ReadonlySet<string>
): { entityId: string } | { participantId: string } {
  if (!effet.bearer.startsWith("participant:")) return { entityId: effet.bearer };
  const id = effet.bearer.slice("participant:".length);
  const p = participants.find((x) => x.id === id);
  if (p?.entity_id && pcEntityIds.has(p.entity_id)) return { entityId: p.entity_id };
  return { participantId: id };
}
