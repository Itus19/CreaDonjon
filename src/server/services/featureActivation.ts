import "server-only";
import { areaTargets, rangeCheck } from "@/src/core/rules/geometry";
import type { BonusDie } from "@/src/core/rules/sheet";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { planActivation, type ActivationRefusal } from "@/src/core/rules/activation";
import { effectToRow, type ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import type { EffectNode, ResolvedEffect, TriggerActorState, TriggerContext } from "@/src/core/rules/triggers";
import { zActivationBlockData, type ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { orderParticipants } from "@/src/server/services/combats";
import { getActiveCombatForCampaign, listCombatParticipants, type CombatParticipantRow } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { deleteFeatureEffect, insertFeatureEffect, listFeatureEffectsForBearers } from "@/src/server/repos/activeEffects";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { resolveEntryBlocksInRuleset } from "@/src/server/services/rules";
import { getCampaign } from "@/src/server/services/campaigns";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { setConcentration } from "@/src/server/services/concentration";
import { expireFeatureEffects } from "@/src/server/services/effectExpiry";
import { applySignedEngineChange, readCombatParticipantsSigned, type EngineChangeLine } from "@/src/server/services/engineSigning";
import { applyResolvedEffects, targetSaveBonus } from "@/src/server/services/targetedRoll";
import { serverRng } from "@/src/server/services/rng";
import { actorNumbersFor } from "@/src/server/services/actorNumbers";
import { spendTurnBudgetFor } from "@/src/server/services/turnBudgetWrite";
import { applyCastOption } from "@/src/core/rules/turnBudget";

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
  | "target_not_found"
  /** V3.1-165 (ADR 0076) : un sort que le personnage ne connaît pas, un emplacement épuisé, une option de lancement inconnue. */
  | "spell_not_known"
  | "no_slot_available"
  | "unknown_cast_option"
  /** V3.1-169 (ADR 0077) : sur le plan, une cible ou une zone hors de portée ; une zone qui ne se pose pas (lanceur non posé, sans point, sans direction) ; une cible retirée qui n'était pas dans la zone. */
  | "out_of_range"
  | "area_unplaced"
  | "target_out_of_area";

export interface ActivateFeatureSuccess {
  ok: true;
  /** Ce qui s'est passé, en phrases (le journal en reçoit la version des joueurs). */
  changes: string[];
  /** Les effets qui durent posés, par porteur. */
  applied: { bearer: string; label: string }[];
  /** Usages consommés après l'activation. */
  used: Record<string, number>;
  /** V3.1-165 (ADR 0076) : le budget du tour est dépassé (en combat) ; signalé, jamais bloquant (ADR 0029). */
  overBudget: boolean;
  /**
   * V3.1-131 : le résultat par cible, pour la carte de l'onglet Actions. Une
   * joueuse n'en reçoit que le verdict (ADR 0070 : les chiffres d'un monstre
   * restent au MJ) ; `save` n'est rempli que pour le MJ.
   */
  targets: { participantId: string; label: string; saved: boolean | null; applied: string[]; save?: { roll: number; total: number; dc: number } }[];
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
    /**
     * V3.1-165 (ADR 0076) : `ruleKey` est un SORT que le personnage connaît ;
     * l'emplacement dépensé (`slot.level` des formules), et l'option de lancement
     * offerte par l'une de ses aptitudes (Sort accéléré).
     */
    spell?: { slotLevel: number; castOption?: { ruleKey: string; optionId: string }; /** Lancé par un effet `cast_spell` gratuit : aucun emplacement. */ free?: boolean };
    /** V3.1-165 : déjà payé ailleurs (une réaction jouée par sa fenêtre) : le budget du tour n'est pas touché. */
    skipBudget?: boolean;
    /**
     * V3.1-169 (ADR 0077) : une activation de zone posée sur le plan — le
     * point où elle est posée, et vers où vise un cône ou une ligne. Ses cibles
     * sont calculées ici ; `targetParticipantIds` dit alors, pour le MJ
     * seulement, celles qu'il garde (il en retire, n'en ajoute jamais).
     */
    area?: { point?: { x: number; y: number }; aim?: { x: number; y: number } };
  }
): Promise<ActivateFeatureSuccess | { ok: false; reason: ActivateFeatureFailure; detail?: string }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };
  // Une règle ne se joue que si le personnage la possède : jamais par sa seule clé. Un sort : connu, ou accordé par une aptitude.
  // Un sort lancé par un effet gratuit (`cast_spell`) n'a pas à être connu : c'est l'aptitude qui l'accorde.
  if (params.spell && !params.spell.free) {
    const connu =
      (ctx.spellcastingData?.known ?? []).some((k) => k.ref.kind === "rule" && k.ref.key === params.ruleKey) || ctx.sheet.grantedSpells.some((g) => g.key === params.ruleKey);
    if (!connu) return { ok: false, reason: "spell_not_known" };
  } else if (!params.spell && !ctx.sheet.features.some((f) => f.key === params.ruleKey)) {
    return { ok: false, reason: "feature_not_owned" };
  }

  const resolved = await resolveEntryBlocksInRuleset(supabase, ctx.rulesetId, params.ruleKey);
  const lu = zActivationBlockData.safeParse(resolved?.blocksByType.get("activation"));
  if (!lu.success) return { ok: false, reason: "no_activation_block" };
  let block: ActivationBlockData = lu.data;
  const found = block.activations.find((a) => a.id === params.activationId);
  if (!found) return { ok: false, reason: "unknown_activation" };
  // V3.1-165 : l'option de lancement (Sort accéléré) change le coût du sort : son temps, et ses ressources s'ajoutent.
  let activation = found;
  if (params.spell?.castOption) {
    const ref = params.spell.castOption;
    const option = ctx.sheet.features
      .find((f) => f.key === ref.ruleKey)
      ?.activation?.activations.flatMap((a) => a.cast_options ?? [])
      .find((o) => o.id === ref.optionId);
    if (!option) return { ok: false, reason: "unknown_cast_option" };
    activation = { ...found, cost: applyCastOption(found.cost, option) };
    block = { ...block, activations: block.activations.map((a) => (a.id === found.id ? activation : a)) };
  }
  const variant = params.variantId ? activation.variants?.find((v) => v.id === params.variantId) : undefined;
  const effectNodes = variant ? variant.effects : activation.effects;

  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };

  // Le combat en cours : seulement s'il y a des cibles à y lire.
  let combatId: string | null = null;
  let participants: CombatParticipantRow[] = [];
  let round: number | null = null;
  let currentTurn: string | null = null;
  const deZone = activation.targets.kind === "area" && activation.targets.area !== undefined;
  if (params.targetParticipantIds.length > 0 || deZone) {
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

  // V3.1-169 (ADR 0077) : le plan. Une zone calcule ses cibles ; une portée se vérifie quand les deux sont posés.
  const posDe = (p: CombatParticipantRow | undefined) => (p && p.pos_x !== null && p.pos_y !== null ? { x: Number(p.pos_x), y: Number(p.pos_y) } : null);
  const lanceur = participants.find((p) => p.entity_id === params.entityId);
  const portee = activation.targets.range?.value;
  const avertissements: string[] = [];
  let cibles: string[] = [...params.targetParticipantIds];
  if (deZone && activation.targets.area) {
    const zone = areaTargets({
      area: activation.targets.area,
      caster: { id: lanceur?.id ?? "", pos: posDe(lanceur) },
      ...(params.area?.point ? { point: params.area.point } : {}),
      ...(params.area?.aim ? { aim: params.area.aim } : {}),
      ...(portee !== undefined ? { range: portee } : {}),
      others: participants.map((p) => ({ id: p.id, pos: posDe(p) })),
    });
    if (!zone.ok) return { ok: false, reason: zone.reason === "out_of_range" ? "out_of_range" : "area_unplaced", detail: zone.reason };
    if (params.callerIsGm && params.targetParticipantIds.length > 0) {
      const hors = params.targetParticipantIds.find((id) => !zone.ids.includes(id));
      if (hors) return { ok: false, reason: "target_out_of_area", detail: hors };
    } else {
      cibles = zone.ids;
    }
  } else if (portee !== undefined && cibles.length > 0) {
    for (const id of cibles) {
      const cible = participants.find((p) => p.id === id);
      const verdict = rangeCheck(posDe(lanceur), posDe(cible), portee);
      if (verdict === "out_of_range") return { ok: false, reason: "out_of_range", detail: cible?.label ?? id };
      // Sans plan (moins de deux jetons posés), rien à dire : la table joue comme avant.
      if (verdict === "unverified" && participants.filter((p) => posDe(p)).length >= 2) avertissements.push(`Portée non vérifiée pour ${cible?.label ?? id} : le MJ tranche.`);
    }
  }

  const pcEntityIds = new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id));
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);

  // Les nombres de celui qui active : ce que ses formules lisent.
  const sheet = ctx.sheet;
  const actorNumbers = actorNumbersFor(ctx, params.ruleKey);
  const actors: Record<string, TriggerActorState> = {
    [params.entityId]: { conditions: [...state.conditions], features: sheet.features.map((f) => f.key), numbers: actorNumbers },
  };
  const abilities = savedAbilities(effectNodes);
  for (const id of cibles) {
    const p = participants.find((x) => x.id === id)!;
    const isPc = p.entity_id !== null && pcEntityIds.has(p.entity_id);
    const numbers: Record<string, number> = {};
    const saveDice: Record<string, BonusDie[]> = {};
    for (const ability of abilities) {
      const found = await targetSaveBonus(supabase, { target: p, isPc, ability, campaignId: params.campaignId, worldId: campaign.worldId, locale: params.locale });
      numbers[`save.${ability}`] = found.bonus;
      // V3.1-156 (ADR 0074) : un PJ béni lance son 1d4 avec sa sauvegarde.
      if (found.dice.length > 0) saveDice[ability] = found.dice;
    }
    actors[`participant:${id}`] = {
      conditions: Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [],
      features: [],
      numbers,
      saveDice,
    };
  }
  const sceneCtx: TriggerContext = { actors };

  const plan = planActivation({
    block,
    activationId: params.activationId,
    variantId: params.variantId,
    actorId: params.entityId,
    targetIds: cibles.map((id) => `participant:${id}`),
    ctx: sceneCtx,
    resources: sheet.resources,
    used: state.resources,
    // Le budget d'action de la table n'est pas tenu en base : le moteur ne le paie pas ici (la boucle du solo le tient).
    budget: null,
    currentTurn,
    round,
    rng: serverRng,
    locale: params.locale,
    ...(params.spell ? { slotLevel: params.spell.slotLevel } : {}),
  });
  if (!plan.ok) return { ok: false, reason: plan.reason, ...(plan.detail ? { detail: plan.detail } : {}) };

  // V3.1-165 : l'emplacement du sort (un sort mineur n'en dépense pas) — ordinaire d'abord, puis la réserve de pacte de ce niveau (ADR 0045).
  let slotPatch: { spell_slots_used?: Record<string, number>; pact_slots_used?: number } = {};
  const niveau = params.spell?.slotLevel ?? 0;
  if (params.spell && !params.spell.free && activation.cost.slot && niveau > 0) {
    const used = state.spell_slots_used[String(niveau)] ?? 0;
    const pact = sheet.spellcasting?.pactSlots;
    if (used < (sheet.spellcasting?.slots[niveau] ?? 0)) slotPatch = { spell_slots_used: { ...state.spell_slots_used, [String(niveau)]: used + 1 } };
    else if (pact && pact.slotLevel === niveau && state.pact_slots_used < pact.count) slotPatch = { pact_slots_used: state.pact_slots_used + 1 };
    else return { ok: false, reason: "no_slot_available" };
  }

  const label = activation.label[params.locale] ?? activation.label.fr ?? activation.id;
  const note = `Activation — ${label} (${ctx.entityName})`;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);

  // 1. Les usages (et l'emplacement d'un sort) : l'état de jeu du personnage, le sien (droit vérifié par la route), en une écriture.
  if (plan.plan.spend.length > 0 || Object.keys(slotPatch).length > 0) {
    await applyRuntimeStateChange(supabase, {
      entityId: params.entityId,
      campaignId: params.campaignId,
      patch: { ...(plan.plan.spend.length > 0 ? { resources: plan.plan.used } : {}), ...slotPatch },
      note: `${note} : ${[...plan.plan.spend.map((s) => `${s.key} −${s.amount}`), ...(Object.keys(slotPatch).length > 0 ? [`emplacement niveau ${niveau}`] : [])].join(", ")}`,
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

  // 3. La concentration, AVANT de poser les nouveaux effets : une nouvelle
  // concentration rompt la précédente et retire ses effets chez toutes leurs
  // cibles (V3.1-24) — même quand elle porte le même nom, sinon relancer
  // « Veille sacrée » empilerait deux fois son bonus.
  if (plan.plan.applied.some((a) => a.concentration)) {
    const change = await setConcentration(supabase, { entityId: params.entityId, campaignId: params.campaignId, incoming: { spell_key: null, label }, actorUserId: params.callerId });
    if (!change.broken) {
      await expireFeatureEffects(supabase, {
        campaignId: params.campaignId,
        events: [{ kind: "concentration_broken", source: params.entityId }],
        callerId: params.callerId,
        callerIsGm: params.callerIsGm,
        ownEntityId: params.entityId,
      });
    }
  }

  // 4. Les effets qui durent : par PJ (son entité) ou par instance de combat (ADR 0073).
  // V3.1-157 : relancer un effet encore actif le RAFRAÎCHIT (même règle, même
  // effet, même porteur), jamais ne l'empile — deux Rages ne font pas +6.
  // Seulement là où l'appelant écrit directement ; le chemin signé d'un joueur
  // vers un monstre ne lit pas les effets de l'instance (ADR 0073).
  const porteursDirects = plan.plan.applied
    .map((effet) => ({ effet, porteur: bearerOf(effet, participants, pcEntityIds) }))
    .filter(({ porteur }) => params.callerIsGm || ("entityId" in porteur && porteur.entityId === params.entityId));
  if (porteursDirects.length > 0) {
    const existants = await listFeatureEffectsForBearers(supabase, {
      campaignId: params.campaignId,
      entityIds: porteursDirects.flatMap(({ porteur }) => ("entityId" in porteur ? [porteur.entityId] : [])),
      participantIds: porteursDirects.flatMap(({ porteur }) => ("participantId" in porteur ? [porteur.participantId] : [])),
    });
    for (const { effet, porteur } of porteursDirects) {
      for (const row of existants) {
        const memePorteur = "entityId" in porteur ? row.entity_id === porteur.entityId : row.combat_participant_id === porteur.participantId;
        const memeEffet = (row.payload as { effectId?: unknown } | null)?.effectId === effet.effectId;
        if (memePorteur && memeEffet && row.source_key === params.ruleKey) await deleteFeatureEffect(supabase, row.id);
      }
    }
  }
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

  const targets = cibles.map((id) => {
    const key = `participant:${id}`;
    const sauvegarde = plan.plan.effects.find((e): e is Extract<ResolvedEffect, { action: "saving_throw" }> => e.action === "saving_throw" && e.who === key);
    return {
      participantId: id,
      label: participants.find((p) => p.id === id)?.label ?? id,
      saved: sauvegarde ? sauvegarde.passed : null,
      applied: plan.plan.applied.filter((a) => a.bearer === key).map((a) => a.label),
      ...(params.callerIsGm && sauvegarde ? { save: { roll: sauvegarde.roll, total: sauvegarde.total, dc: sauvegarde.dc } } : {}),
    };
  });

  // V3.1-165 (ADR 0076) : « lancer un sort » (Compagnon sauvage) joue l'activation du sort nommé, sur soi,
  // sans payer le budget une seconde fois ; un sort lancé ainsi n'en lance pas d'autre (pas de chaîne).
  const lances: string[] = [];
  if (!params.spell?.free) {
    for (const e of plan.plan.effects) {
      if (e.action !== "cast_spell" || e.who !== params.entityId) continue;
      const blocs = await resolveEntryBlocksInRuleset(supabase, ctx.rulesetId, e.spell);
      const sort = zActivationBlockData.safeParse(blocs?.blocksByType.get("activation"));
      const premiere = sort.success ? sort.data.activations[0] : undefined;
      if (!premiere) {
        lances.push(`Le sort « ${e.spell} » ne se joue pas encore (aucune activation) : à jouer à la main.`);
        continue;
      }
      const r = await activateFeature(supabase, {
        ...params,
        ruleKey: e.spell,
        activationId: premiere.id,
        variantId: null,
        targetParticipantIds: [],
        skipBudget: true,
        spell: { slotLevel: premiere.cost.slot?.level ?? 0, free: e.free },
      });
      lances.push(...(r.ok ? r.changes : [`Le sort « ${e.spell} » n'a pas pu être lancé (${r.reason}).`]));
    }
  }

  // V3.1-165 (ADR 0076) : le budget du tour, en combat — le coût de l'activation, et ce qu'elle accorde (Sursaut d'action).
  const accorde = plan.plan.effects.flatMap((e) =>
    e.action === "grant_budget" && e.who === params.entityId && (e.kind === "action" || e.kind === "bonus") ? [{ kind: e.kind, amount: e.amount, ...(e.not_magic ? { notMagic: true } : {}) }] : []
  );
  const budget = params.skipBudget
    ? null
    : await spendTurnBudgetFor(supabase, { campaignId: params.campaignId, actor: { entityId: params.entityId }, kind: activation.cost.action, attacksPerAction: sheet.attacksPerAction, grants: accorde, callerIsGm: params.callerIsGm });

  return {
    ok: true,
    targets,
    changes: [...avertissements, ...outcome.changes, ...lances, ...(budget?.over ? ["Budget du tour dépassé : le MJ tranche."] : [])],
    applied: plan.plan.applied.map((a) => ({ bearer: a.bearer, label: a.label })),
    used: plan.plan.used,
    overBudget: budget?.over ?? false,
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
