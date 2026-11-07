import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { zActivationBlockData, zRollOperation, type Activation } from "@/src/core/schemas/rule-blocks/playable";
import { resolveEntryBlocksInRulesetBatch } from "@/src/server/services/rules";
import {
  applyRollOperations,
  eligibleReactions,
  outcomeOf,
  turnStamp,
  zTurnUsage,
  EMPTY_TURN_USAGE,
  type EligibleReaction,
  type PendingRoll,
  type ReactionCandidate,
  type RollOutcome,
} from "@/src/core/rules/rollWindow";
import type { TriggerActorState, TriggerContext } from "@/src/core/rules/triggers";
import { getActiveCombatForCampaign, listCombatParticipants, type CombatParticipantRow, type CombatRow } from "@/src/server/repos/combats";
import { resolveCharacterActionContext, type CharacterActionContext } from "@/src/server/services/characterActions";
import { getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { orderParticipants } from "@/src/server/services/combats";
import { openRollWindow, readCombatParticipantsSigned } from "@/src/server/services/engineSigning";
import { actorNumbersFor } from "@/src/server/services/actorNumbers";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-160 (ADR 0075) — le jet suspendu, côté ouverture.
 *
 * Au point de décision d'un jet, `interveneOnRoll` rassemble ceux qui
 * pourraient réagir (les PJ du combat et leurs règles à déclencheur),
 * applique d'office les réactions automatiques (Chance), puis :
 *  - personne ne peut choisir : il rend le jet (modifié par l'automatique),
 *    et la résolution continue d'un tenant, comme avant ;
 *  - quelqu'un peut : il ouvre une fenêtre (partie lisible + état figé,
 *    signés ensemble) et rend son identifiant. La reprise
 *    (`rollWindowResume.ts`) se fait par l'auteur du jet, avec ses droits.
 *
 * Ce module n'importe ni `targetedRoll` ni `featureActivation` (pas de cycle) :
 * la reprise, qui les appelle, vit à part.
 */

const zPendingRoll = z.object({
  kind: z.enum(["attack", "save", "check", "damage"]),
  roller: z.string(),
  target: z.string().nullable(),
  natural: z.number().int().nullable(),
  total: z.number(),
  critRange: z.number().int(),
  ac: z.number().int().nullable(),
  dc: z.number().int().nullable(),
  acBonus: z.number(),
  damage: z.object({ base: z.number(), multiplier: z.number() }).nullable(),
});

const zWindowChoice = z.object({
  actorId: z.string(),
  participantId: z.string().nullable(),
  userId: z.string().nullable(),
  ruleKey: z.string(),
  activationId: z.string(),
  reaction: z.boolean(),
  limitKey: z.string().nullable(),
  numbers: z.record(z.string(), z.number()),
  operations: z.array(zRollOperation),
  usage: zTurnUsage,
  /** V3.1-165 (ADR 0076) : une réaction qui est un sort (Bouclier) : l'emplacement qu'elle dépensera. */
  spellSlot: z.number().int().min(1).max(9).optional(),
});
export type WindowChoice = z.infer<typeof zWindowChoice>;

/** Ce qu'il faut pour reprendre : l'entrée d'origine, telle quelle (revalidée par son service à la reprise). */
export const zRollWindowState = z.object({
  __v: z.literal(1),
  /** D'où vient le jet : la reprise rejoue ce chemin (jet ciblé, sauvegarde demandée, test ou sauvegarde de la fiche). */
  origin: z.enum(["targeted", "save_request", "sheet_check"]),
  campaignId: z.string().uuid(),
  combatId: z.string().uuid().nullable(),
  stamp: z.string().nullable(),
  roll: zPendingRoll,
  choices: z.array(zWindowChoice).min(1),
  resume: z.record(z.string(), z.unknown()),
});
export type RollWindowState = z.infer<typeof zRollWindowState>;

export interface ReactorPool {
  candidates: ReactionCandidate[];
  /** Pour chaque acteur : son joueur (null : le MJ), sa ligne de combat, son nom, ses nombres par règle. */
  meta: Record<string, { userId: string | null; participantId: string | null; name: string; numbers: Record<string, Record<string, number>> }>;
  ctx: TriggerContext;
  teams: Record<string, string>;
  /** V3.1-165 : `"<acteur>|<sort>"` → le plus petit emplacement disponible d'un sort de réaction. */
  spellSlots: Record<string, number>;
}

/**
 * Ceux qui pourraient réagir : les PJ du combat dont une règle porte un
 * déclencheur. `only` restreint aux fiches nommées (le chemin d'une joueuse :
 * seulement les siennes). Les contextes déjà chargés sont réutilisés.
 */
export async function gatherReactors(
  supabase: TypedClient,
  params: {
    campaignId: string;
    participants: readonly CombatParticipantRow[];
    pcs: readonly { entity_id: string; user_id: string | null }[];
    only?: ReadonlySet<string>;
    loaded?: readonly CharacterActionContext[];
    /** V3.1-163 : un PJ hors combat (pas de ligne de participant) : ses réactions sur son propre jet, sans compte. */
    standalone?: { entity_id: string; user_id: string | null };
    locale: Locale;
  },
): Promise<ReactorPool> {
  const pool: ReactorPool = { candidates: [], meta: {}, ctx: { actors: {} }, teams: {}, spellSlots: {} };
  const ordre = orderParticipants(params.participants);
  for (const p of params.participants) {
    const key = p.entity_id && params.pcs.some((c) => c.entity_id === p.entity_id) ? p.entity_id : `participant:${p.id}`;
    pool.teams[key] = p.is_ally || key === p.entity_id ? "pj" : "adversaires";
  }
  const rows: { pc: { entity_id: string; user_id: string | null }; p: CombatParticipantRow | null }[] = params.participants.flatMap((p) => {
    const pc = p.entity_id ? params.pcs.find((c) => c.entity_id === p.entity_id) : undefined;
    return pc ? [{ pc, p }] : [];
  });
  if (params.standalone && !rows.some((r) => r.pc.entity_id === params.standalone!.entity_id)) {
    rows.push({ pc: params.standalone, p: null });
    pool.teams[params.standalone.entity_id] = "pj";
  }
  for (const { pc, p } of rows) {
    if (params.only && !params.only.has(pc.entity_id)) continue;
    const ctx = params.loaded?.find((c) => c.entityId === pc.entity_id) ?? (await resolveCharacterActionContext(supabase, pc.entity_id, params.campaignId, params.locale));
    if (!ctx) continue;
    const features = ctx.sheet.features.filter((f) => f.activation?.activations.some((a) => a.trigger));
    const sorts = await reactionSpells(supabase, ctx);
    if (features.length === 0 && sorts.length === 0) continue;
    const state = await getEntityRuntimeState(supabase, pc.entity_id, params.campaignId);
    const usage = zTurnUsage.safeParse(p?.turn_usage);
    const numbersByRule: Record<string, Record<string, number>> = {};
    for (const f of features) {
      numbersByRule[f.key] = actorNumbersFor(ctx, f.key);
      for (const a of f.activation!.activations) {
        if (!a.trigger) continue;
        pool.candidates.push({
          actorId: pc.entity_id,
          ruleKey: f.key,
          activation: a,
          resources: ctx.sheet.resources,
          used: state.resources,
          usage: usage.success ? usage.data : EMPTY_TURN_USAGE,
          ownTurnIndex: p ? Math.max(0, ordre.findIndex((o) => o.id === p.id)) : null,
        });
      }
    }
    // V3.1-165 (ADR 0076) : un sort de réaction préparé (Bouclier), tant qu'un emplacement de son niveau ou plus reste.
    for (const sort of sorts) {
      const base = sort.activation.cost.slot?.level ?? 0;
      const libre = base === 0 ? 0 : lowestFreeSlot(ctx, state, base);
      if (libre === null) continue;
      numbersByRule[sort.key] = { ...actorNumbersFor(ctx, sort.key), "slot.level": libre };
      if (libre > 0) pool.spellSlots[`${pc.entity_id}|${sort.key}`] = libre;
      pool.candidates.push({
        actorId: pc.entity_id,
        ruleKey: sort.key,
        activation: sort.activation,
        resources: ctx.sheet.resources,
        used: state.resources,
        usage: usage.success ? usage.data : EMPTY_TURN_USAGE,
        ownTurnIndex: p ? Math.max(0, ordre.findIndex((o) => o.id === p.id)) : null,
      });
    }
    pool.meta[pc.entity_id] = { userId: pc.user_id, participantId: p?.id ?? null, name: ctx.entityName, numbers: numbersByRule };
    const premiere = features[0]?.key ?? sorts[0]?.key ?? "";
    const actor: TriggerActorState = { conditions: [...state.conditions], features: ctx.sheet.features.map((f) => f.key), numbers: numbersByRule[premiere] ?? {} };
    pool.ctx = { actors: { ...pool.ctx.actors, [pc.entity_id]: actor } };
  }
  return pool;
}

export type InterveneResult =
  | { kind: "continue"; roll: PendingRoll; automatic: EligibleReaction[] }
  | { kind: "window"; windowId: string };

/** L'ordre de l'ADR 0075 : l'auteur du jet, puis la cible, puis les autres. */
function rank(e: EligibleReaction, roll: PendingRoll): number {
  if (e.actorId === roll.roller) return 0;
  if (e.actorId === roll.target) return 1;
  return 2;
}

const OUTCOME_FR: Record<RollOutcome, string> = { hit: "touché", miss: "raté", success: "réussi", failure: "raté" };

/**
 * Le point de décision. `label` est la phrase des joueurs (« Gobelin attaque
 * Lia : 17 »), sans CA ni DD. `resume` est l'entrée à rejouer à la reprise.
 */
export async function interveneOnRoll(
  supabase: TypedClient,
  params: {
    campaignId: string;
    combat: CombatRow | null;
    roll: PendingRoll;
    pool: ReactorPool;
    label: string;
    resume: Record<string, unknown>;
    /** V3.1-163 : par défaut un jet ciblé. */
    origin?: RollWindowState["origin"];
    locale: Locale;
  },
): Promise<InterveneResult> {
  const stamp = params.combat ? turnStamp(params.combat.round, params.combat.turn_index) : null;
  const { automatic, choices } = eligibleReactions({ roll: params.roll, candidates: params.pool.candidates, ctx: params.pool.ctx, teams: params.pool.teams, stamp, rng: serverRng });

  // Les réactions automatiques (Chance) s'appliquent d'office, avant la fenêtre.
  const opsOf = (e: EligibleReaction) => params.pool.candidates.find((c) => c.actorId === e.actorId && c.ruleKey === e.ruleKey && c.activation.id === e.activationId)?.activation.roll_operations ?? [];
  const numbersOf = (e: EligibleReaction) => params.pool.meta[e.actorId]?.numbers[e.ruleKey] ?? {};
  const roll = automatic.length === 0 ? params.roll : applyRollOperations(params.roll, automatic.map((e) => ({ actorId: e.actorId, operations: opsOf(e), numbers: numbersOf(e) })), serverRng).roll;
  if (choices.length === 0) return { kind: "continue", roll, automatic };

  // Après l'automatique, l'éligibilité peut avoir changé (Chance a relancé un 1) : on la refait.
  const again = automatic.length === 0 ? choices : eligibleReactions({ roll, candidates: params.pool.candidates, ctx: params.pool.ctx, teams: params.pool.teams, stamp, rng: serverRng }).choices;
  if (again.length === 0) return { kind: "continue", roll, automatic };
  const ordered = [...again].sort((a, b) => rank(a, roll) - rank(b, roll));

  const usageOf = (e: EligibleReaction) => params.pool.candidates.find((c) => c.actorId === e.actorId)?.usage ?? EMPTY_TURN_USAGE;
  const stateChoices: WindowChoice[] = ordered.map((e) => ({
    actorId: e.actorId,
    participantId: params.pool.meta[e.actorId]?.participantId ?? null,
    userId: params.pool.meta[e.actorId]?.userId ?? null,
    ruleKey: e.ruleKey,
    activationId: e.activationId,
    reaction: e.reaction,
    limitKey: e.limitKey,
    numbers: numbersOf(e),
    operations: [...opsOf(e)],
    usage: usageOf(e),
    ...(params.pool.spellSlots[`${e.actorId}|${e.ruleKey}`] ? { spellSlot: params.pool.spellSlots[`${e.actorId}|${e.ruleKey}`] } : {}),
  }));
  const activationLabel = (e: EligibleReaction) => {
    const a = params.pool.candidates.find((c) => c.actorId === e.actorId && c.ruleKey === e.ruleKey && c.activation.id === e.activationId)?.activation;
    return a ? (a.label[params.locale] ?? a.label.fr ?? a.id) : e.activationId;
  };
  const outcome = outcomeOf(roll);
  const state: RollWindowState = {
    __v: 1,
    origin: params.origin ?? "targeted",
    campaignId: params.campaignId,
    combatId: params.combat?.id ?? null,
    stamp,
    roll,
    choices: stateChoices,
    resume: params.resume,
  };
  const windowId = await openRollWindow(supabase, {
    campaignId: params.campaignId,
    window: {
      combat_id: params.combat?.id ?? null,
      kind: roll.kind,
      label: params.label,
      // Ce que tout répondant lit : le total et l'issue, jamais la CA ni le DD (ADR 0040).
      view: { total: roll.total, natural: roll.natural, outcome: outcome ? OUTCOME_FR[outcome] : null },
      choices: ordered.map((e) => ({
        user_id: params.pool.meta[e.actorId]?.userId ?? null,
        actor_label: params.pool.meta[e.actorId]?.name ?? "?",
        rule_key: e.ruleKey,
        activation_id: e.activationId,
        label: activationLabel(e),
        changes_outcome: e.changesOutcome,
      })),
      state: zRollWindowState.parse(state) as unknown as Record<string, unknown>,
    },
  });
  return { kind: "window", windowId };
}

/**
 * V3.1-163 — le réservoir d'un seul personnage, pour un jet qui ne regarde
 * que lui (sa sauvegarde, son test) : en combat, avec sa ligne (réaction et
 * limite comptées) ; hors combat, sans compte. Une joueuse lit le combat par
 * une demande signée (ADR 0069).
 */
export async function selfReactorPool(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string | null; callerIsGm: boolean; loaded?: CharacterActionContext; locale: Locale },
): Promise<{ pool: ReactorPool; combat: CombatRow | null }> {
  const combat = await getActiveCombatForCampaign(supabase, params.campaignId);
  const running = combat && combat.status === "running" ? combat : null;
  const participants = running
    ? params.callerIsGm
      ? await listCombatParticipants(supabase, running.id)
      : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: running.id })
    : [];
  const pc = { entity_id: params.entityId, user_id: params.userId };
  const pool = await gatherReactors(supabase, {
    campaignId: params.campaignId,
    participants,
    pcs: [pc],
    only: new Set([params.entityId]),
    loaded: params.loaded ? [params.loaded] : [],
    standalone: pc,
    locale: params.locale,
  });
  return { pool, combat: running };
}

/** V3.1-165 : les sorts connus du personnage qui portent une activation à déclencheur (une lecture groupée). */
async function reactionSpells(supabase: TypedClient, ctx: CharacterActionContext): Promise<{ key: string; activation: Activation }[]> {
  const cles = [
    ...new Set([...(ctx.spellcastingData?.known ?? []).flatMap((k) => (k.ref.kind === "rule" ? [k.ref.key] : [])), ...ctx.sheet.grantedSpells.map((g) => g.key)]),
  ];
  if (cles.length === 0) return [];
  const blocs = await resolveEntryBlocksInRulesetBatch(supabase, ctx.rulesetId, cles);
  const out: { key: string; activation: Activation }[] = [];
  for (const cle of cles) {
    const lu = zActivationBlockData.safeParse(blocs.get(cle)?.blocksByType.get("activation"));
    if (!lu.success) continue;
    for (const a of lu.data.activations) if (a.trigger) out.push({ key: cle, activation: a });
  }
  return out;
}

/** Le plus petit emplacement libre d'au moins `base` (ordinaire, puis la réserve de pacte) ; `null` s'il n'y en a plus. */
function lowestFreeSlot(ctx: CharacterActionContext, state: { spell_slots_used: Record<string, number>; pact_slots_used: number }, base: number): number | null {
  for (let n = base; n <= 9; n++) {
    if ((state.spell_slots_used[String(n)] ?? 0) < (ctx.sheet.spellcasting?.slots[n] ?? 0)) return n;
  }
  const pact = ctx.sheet.spellcasting?.pactSlots;
  if (pact && pact.slotLevel >= base && state.pact_slots_used < pact.count) return pact.slotLevel;
  return null;
}
