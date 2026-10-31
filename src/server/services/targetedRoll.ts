import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { budgetOf, type SceneState } from "@/src/core/rules/scene";
import { spendFromBudget, type BudgetKind } from "@/src/core/rules/actionBudget";
import { applyEffects, type ApplyResult, type TurnActor, type TurnChange } from "@/src/core/rules/turn";
import { eventsForAttack, eventsForDamage } from "@/src/core/rules/gameEvents";
import { resolveAttackRoll, resolveDamageRoll, type AttackRollResult } from "@/src/core/rules/action";
import type { FiredEvent, ResolvedEffect } from "@/src/core/rules/triggers";
import { attackVerdict, damageAfterSave, isOutOfFight, monsterSaveBonus, type AttackVerdict } from "@/src/core/rules/targeting";
import { creatureTypeOf, isValidTarget, type TargetProfile, type TargetRefusal } from "@/src/core/rules/targetRestriction";
import { zSaveRequestEffect, type SaveRequestEffect } from "@/src/core/rules/saveRequest";
import { insertSaveRequest } from "@/src/server/repos/saveRequests";
import { naturalD20FromTrace } from "@/src/core/dice/rollAttribution";
import { formatFormulaNode } from "@/src/core/formula/format";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { rollsForDisplay, type RollDisplay } from "@/src/core/dice/diceTool";
import { zActionsBlockData, zLegendaryActionsBlockData, zStatBlockBlockData, type StatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import {
  castSpell,
  readSpellMechanics,
  resolveCharacterActionContext,
  rollSpellAttack,
  rollWeaponAttack,
  rollWeaponDamage,
  type CharacterActionContext,
} from "@/src/server/services/characterActions";
import { fireTriggersForCharacter } from "@/src/server/services/triggerRuntime";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import {
  applySignedEngineChange,
  engineSigningKeyFromEnv,
  readCombatParticipantsSigned,
  signDamageToken,
  verifyDamageToken,
  type EngineChangeLine,
  type JetonDegats,
} from "@/src/server/services/engineSigning";
import { canonicalJson } from "@/src/core/rules/engineChange";
import { attackFactForPlayer, describeChangeForPlayer } from "@/src/core/rules/playerFacing";
import { patchCombatParticipant } from "@/src/server/services/combats";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getCampaign } from "@/src/server/services/campaigns";
import { getCombatById, getCombatParticipantById, listCombatParticipants, updateCombat, type CombatParticipantRow } from "@/src/server/repos/combats";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import { ABILITY_LABELS, type Ability } from "@/src/core/rules/abilities";
import { serverRng } from "@/src/server/services/rng";
import type { TargetedRollInput } from "@/lib/combats/schemas";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-105 (ADR 0042) — le cœur commun de résolution.
 *
 * Deux parties, deux appelants :
 * - `applyResolvedEffects` — APPLIQUER des effets déjà résolus aux acteurs
 *   d'un tour (le personnage qui agit, les participants du combat), les
 *   écrire et les journaliser. Extrait tel quel de la boucle de tour du solo
 *   (`turnLoop.ts`), qui l'appelle désormais ; la table l'appelle aussi.
 * - `resolveTargetedRoll` — la table : un jet ciblé (attaque, dégâts, sort à
 *   attaque, sort à sauvegarde, soin) contre un participant du combat en
 *   cours, lancé par le serveur (règle 8), tranché par le moteur, appliqué.
 *
 * Aucun modèle d'IA ici (`targetedRoll.noAi.test.ts`).
 */

// ---------------------------------------------------------------------------
// Appliquer
// ---------------------------------------------------------------------------

/** Les PV, états, jets contre la mort et le budget d'un personnage qui agit. */
async function loadActor(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; hpMax: number; budgetSpeed: number; scene: SceneState | null }
): Promise<TurnActor> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  return {
    hp: { current: state.hp.current, max: params.hpMax, temp: state.hp.temp },
    conditions: [...state.conditions],
    deathSaves: { ...state.death_saves },
    resources: { ...state.resources },
    budget: params.scene ? budgetOf(params.scene, params.entityId, params.budgetSpeed) : { action: 1, bonus: 1, reaction: 1, movement: params.budgetSpeed, free: 1 },
  };
}

/** Une phrase par changement — c'est ce que l'écran affiche et ce que la narration recevra. */
function describeChange(change: TurnChange, nameOf: (id: string) => string): string | null {
  switch (change.kind) {
    case "hp":
      return `${nameOf(change.who)} : ${change.from.current} → ${change.to.current} PV (${change.note})`;
    case "condition":
      return `${nameOf(change.who)} ${change.added ? "subit" : "n'a plus"} : ${change.key}`;
    case "zone":
      return `${nameOf(change.who)} passe de ${change.from} à ${change.to}`;
    case "budget":
      return `${nameOf(change.who)} — ${change.budget} : ${change.from} → ${change.to}${change.overBudget ? " (hors budget)" : ""}`;
    case "resource":
      return `${nameOf(change.who)} — ${change.key} : ${change.from} → ${change.to}`;
    case "roll":
      return `${change.label} : ${change.value}${change.note ? ` — ${change.note}` : ""}`;
    case "hint":
    case "ignored":
      return null;
  }
}

/**
 * Sans scène en base, le tour se joue quand même : on en fabrique une, le
 * temps de l'appliquer, et on ne l'écrit pas. Une règle qui déplace
 * quelqu'un n'aura alors rien à déplacer et le dira.
 */
export function emptySceneFor(existing: SceneState | null): SceneState {
  return (
    existing ?? {
      __v: 4,
      locationId: "hors-scene",
      present: [],
      time: { day: 1, hour: 8, minute: 0 },
      lighting: "bright",
      activeCombatId: null,
      recentEvents: [],
      budgets: {},
      sketches: [],
      weather: null,
    }
  );
}

/**
 * Fait partir les déclencheurs d'un personnage pour des événements déjà
 * émis. Une règle maison cassée n'emporte jamais un jet acquis : l'échec est
 * CONSIGNÉ en indication, jamais tu (CLAUDE.md).
 */
export async function fireActorTriggers(
  supabase: TypedClient,
  params: { ctx: CharacterActionContext; actorEntityId: string; campaignId: string; events: readonly FiredEvent[]; scene: SceneState | null }
): Promise<ResolvedEffect[]> {
  if (params.events.length === 0) return [];
  const effects: ResolvedEffect[] = [];
  const runtime = await getEntityRuntimeState(supabase, params.actorEntityId, params.campaignId);
  for (const event of params.events) {
    try {
      const out = await fireTriggersForCharacter(supabase, {
        rulesetId: params.ctx.rulesetId,
        subject: params.actorEntityId,
        sheet: params.ctx.sheet,
        runtime,
        event,
        scene: params.scene ?? undefined,
      });
      effects.push(...out.effects);
    } catch (err) {
      effects.push({
        action: "narrate_hint",
        text: `Règle non évaluée sur « ${event.event} » : ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return effects;
}

export interface ApplyEffectsOutcome {
  applied: ApplyResult;
  persisted: string[];
  changes: string[];
  hints: string[];
  ignored: string[];
  applicationEventId: string | null;
}

/**
 * Applique des effets résolus et les écrit.
 *
 * Les acteurs : le personnage qui agit (s'il y en a un — un monstre du combat
 * n'a pas de fiche), et chaque participant du combat, sous la clé
 * `participant:<id>`. Un participant qui est un PJ de la campagne porte ses
 * jets contre la mort (ADR 0036 §8).
 *
 * La persistance : un participant par `patchCombatParticipant`, qui écrit
 * aussi l'état de jeu d'un PJ et journalise un événement `combat` annulable
 * (« ↶ Annuler » de l'écran d'initiative) ; le personnage qui agit par
 * `applyRuntimeStateChange`. Puis un `rule_application` qui dit, en clair,
 * ce qui a changé.
 */
export async function applyResolvedEffects(
  supabase: TypedClient,
  params: {
    campaignId: string;
    callerId: string;
    actor: { entityId: string; name: string; hpMax: number; speed: number } | null;
    /** La scène du tour (budgets, zones) ; `null` : une scène vide, jamais écrite ici. */
    scene: SceneState | null;
    /** La dépense de CETTE action ; `null` : rien (une résolution chaînée, ou la table). */
    spend: BudgetKind | null;
    effects: ResolvedEffect[];
    note: string;
    fromEventId: string | null;
    combatId: string | null;
    /**
     * V3.1-104 (ADR 0041) : l'appelant est un joueur. Ce qui n'est pas à lui
     * (participants du combat, état de jeu d'un autre personnage) s'écrit par
     * un changement SIGNÉ ; seul son personnage (`ownEntityIds`) s'écrit
     * directement. Absent : écriture directe (le MJ).
     */
    signedWrites?: { ownEntityIds: ReadonlySet<string>; /** Le `nonce` du jeton de dégâts : la base refuse qu'il serve deux fois. */ nonce?: string };
    /** V3.1-107 : les participants déjà lus (lecture signée d'un joueur) ; absent : lus ici. */
    participants?: CombatParticipantRow[];
  }
): Promise<ApplyEffectsOutcome> {
  const participants = params.participants ?? (params.combatId ? await listCombatParticipants(supabase, params.combatId) : []);
  const pcEntityIds = participants.some((p) => p.entity_id)
    ? new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id))
    : new Set<string>();

  const actors: Record<string, TurnActor> = {};
  const names: Record<string, string> = {};
  if (params.actor) {
    actors[params.actor.entityId] = await loadActor(supabase, {
      campaignId: params.campaignId,
      entityId: params.actor.entityId,
      hpMax: params.actor.hpMax,
      budgetSpeed: params.actor.speed,
      scene: params.scene,
    });
    names[params.actor.entityId] = params.actor.name;
  }
  for (const p of participants) {
    const key = `participant:${p.id}`;
    const isPc = p.entity_id !== null && pcEntityIds.has(p.entity_id);
    actors[key] = {
      hp: { current: p.hp_current ?? 0, max: p.hp_max ?? p.hp_current ?? 0, temp: p.temp_hp },
      conditions: Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [],
      resources: {},
      budget: { action: 1, bonus: 1, reaction: 1, movement: 9, free: 1 },
      ...(isPc && p.entity_id ? { deathSaves: { ...(await getEntityRuntimeState(supabase, p.entity_id, params.campaignId)).death_saves } } : {}),
    };
    names[key] = p.label;
  }

  if (params.actor && params.spend !== null) {
    const spend = spendFromBudget(actors[params.actor.entityId].budget, params.spend);
    actors[params.actor.entityId] = { ...actors[params.actor.entityId], budget: spend.budget };
  }

  const applied = applyEffects({ scene: params.scene ?? emptySceneFor(null), actors }, params.effects);

  const persisted: string[] = [];
  const signes: EngineChangeLine[] = [];
  const nonSignables: string[] = [];
  for (const [who, after] of Object.entries(applied.state.actors)) {
    const before = actors[who];
    const changedHp = before.hp.current !== after.hp.current || before.hp.temp !== after.hp.temp;
    const changedConditions = before.conditions.join("|") !== after.conditions.join("|");
    const changedDeath =
      before.deathSaves !== undefined &&
      after.deathSaves !== undefined &&
      (before.deathSaves.success !== after.deathSaves.success || before.deathSaves.fail !== after.deathSaves.fail);
    if (!changedHp && !changedConditions && !changedDeath) continue;

    if (params.signedWrites && !params.signedWrites.ownEntityIds.has(who)) {
      // V3.1-104 : PV et états seulement — les jets contre la mort d'une autre
      // fiche ne sont pas dans la liste signable, le MJ les applique.
      const valeurs = {
        ...(changedHp ? { hp: after.hp.current, temp_hp: after.hp.temp } : {}),
        ...(changedConditions ? { conditions: after.conditions } : {}),
      };
      if (changedDeath) nonSignables.push(`Jets contre la mort de ${names[who] ?? who} : à appliquer par le MJ.`);
      if (Object.keys(valeurs).length === 0) continue;
      if (who.startsWith("participant:")) {
        const participantId = who.slice("participant:".length);
        signes.push({ kind: "participant", id: participantId, ...valeurs });
        // Un PJ du combat : son état de jeu suit, dans le même changement signé.
        const entite = participants.find((p) => p.id === participantId)?.entity_id;
        if (entite && pcEntityIds.has(entite)) signes.push({ kind: "runtime", id: entite, ...valeurs });
      } else {
        signes.push({ kind: "runtime", id: who, ...valeurs });
      }
      persisted.push(names[who] ?? who);
      continue;
    }

    if (who.startsWith("participant:")) {
      const participantId = who.slice("participant:".length);
      const row = await getCombatParticipantById(supabase, participantId);
      if (!row) continue;
      await patchCombatParticipant(supabase, {
        participantId,
        patch: {
          ...(changedHp ? { hpCurrent: after.hp.current, tempHp: after.hp.temp } : {}),
          ...(changedConditions ? { conditions: after.conditions } : {}),
          ...(changedDeath && after.deathSaves ? { deathSaves: after.deathSaves } : {}),
        },
        actorUserId: params.callerId,
        note: params.note,
      });
      persisted.push(names[who] ?? participantId);
      continue;
    }

    await applyRuntimeStateChange(supabase, {
      entityId: who,
      campaignId: params.campaignId,
      patch: {
        ...(changedHp ? { hp: { current: after.hp.current, temp: after.hp.temp } } : {}),
        ...(changedConditions ? { conditions: after.conditions } : {}),
        ...(changedDeath && after.deathSaves ? { death_saves: after.deathSaves } : {}),
      },
      note: params.note,
      sessionId: await getOrOpenSessionForCampaign(supabase, params.campaignId),
      actor: "player",
      actorUserId: params.callerId,
    });
    persisted.push(names[who] ?? who);
  }

  if (signes.length > 0) {
    await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: signes, ...(params.signedWrites?.nonce ? { nonce: params.signedWrites.nonce } : {}) });
  }

  const nameOf = (id: string) => names[id] ?? id;
  // V3.1-107 (ADR 0069) : un joueur ne lit jamais les PV d'un adversaire, ni ici ni dans le journal.
  const pourJoueur = (who: string) => {
    const p = who.startsWith("participant:") ? participants.find((x) => `participant:${x.id}` === who) : undefined;
    const allie = !p || p.is_ally || (p.entity_id !== null && pcEntityIds.has(p.entity_id));
    return { name: nameOf(who), ally: allie, hpMax: p?.hp_max ?? actors[who]?.hp.max ?? 0 };
  };
  const changes = applied.changes
    .map((c) => (params.signedWrites ? describeChangeForPlayer(c, pourJoueur) : describeChange(c, nameOf)))
    .filter((line): line is string => line !== null);
  const ignored = [
    ...applied.changes.filter((c): c is Extract<TurnChange, { kind: "ignored" }> => c.kind === "ignored").map((c) => c.reason),
    ...nonSignables,
  ];
  const hints = applied.changes
    .filter((c): c is Extract<TurnChange, { kind: "hint" }> => c.kind === "hint")
    .map((c) => c.text);

  let applicationEventId: string | null = null;
  if (applied.changes.length > 0) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
    const seq = await nextEventSeq(supabase, sessionId);
    const event = await insertSessionEvent(supabase, {
      sessionId,
      seq,
      kind: "rule_application",
      actor: "system",
      actorUserId: params.callerId,
      payload: {
        __v: 1,
        from_event: params.fromEventId,
        // V3.1-107 (ADR 0069) : le journal est lisible des joueurs ; au nom d'un joueur, ni les effets ni les
        // changements bruts (PV de la cible), seulement les phrases.
        ...(params.signedWrites ? {} : { effects: params.effects, changes: applied.changes }),
        persisted,
        // V3-B4 / V3-D4 : les phrases montrées à l'écran, écrites une fois,
        // relues telles quelles par la narration et le fil.
        changes_text: changes,
        hints_text: hints,
        ignored_text: ignored,
      } as unknown as Json,
    });
    applicationEventId = event.id;
  }

  return { applied, persisted, changes, hints, ignored, applicationEventId };
}

// ---------------------------------------------------------------------------
// Résoudre un jet ciblé (la table)
// ---------------------------------------------------------------------------

export type TargetedRollErrorReason =
  | "not_running"
  | "target_not_found"
  | "actor_not_found"
  | "invalid_action"
  | "no_attack"
  | "no_save_data"
  | "no_formula"
  | "no_slot_available"
  | "not_a_weapon"
  | "item_not_found"
  | "not_a_spellcaster"
  | "not_found"
  | "invalid_target"
  /** V3.1-107 : un sort à sauvegarde crée une demande, réservée au MJ (ADR 0044). */
  | "save_gm_only";

/** La demande de dégâts posée par une attaque qui touche : même acteur, même action, même cible ; dés doublés au critique. */
export interface ChainedDamage {
  kind: "damage";
  actor: TargetedRollInput["actor"];
  action: TargetedRollInput["action"];
  targetId: string;
  critical: boolean;
  /** V3.1-107 : au nom d'un joueur, le jeton signé à présenter avec la demande de dégâts. */
  token?: string;
}

export type TargetedRollResult =
  | {
      ok: true;
      verdict: AttackVerdict | null;
      amount: number | null;
      facts: string[];
      changes: string[];
      hints: string[];
      ignored: string[];
      targetOutOfFight: boolean;
      chained: ChainedDamage | null;
      rollEventId: string;
      /** V3.1-111 : un sort à sauvegarde ne s'applique pas ici — la cible répond à cette demande. */
      saveRequestId: string | null;
      /** V3.1-38 (suite) : le jet tel que l'outil de dés le montre (attaque, ou dégâts) ; `null` sans dés à montrer. */
      dice: RollDisplay | null;
    }
  | { ok: false; reason: TargetedRollErrorReason; detail?: { refusal: TargetRefusal; value: string } };

interface MonsterBlocks {
  statBlock: StatBlockBlockData | null;
  actions: { name: string; attack_bonus?: number; damage?: { dice: Parameters<typeof formatFormulaNode>[0]; type?: string }[] }[];
}

/**
 * Les blocs d'un monstre, lus comme l'écran du MJ les lit (V3.1-106, relu par
 * Opus) : par la chaîne du ruleset du monde (une variante trouve le monstre de
 * sa base, surcharges comprises) et dans la langue de l'appelant. Sans cela,
 * le nom d'action envoyé par l'écran (« Morsure ») ne correspondait jamais au
 * bloc brut (« Bite ») : aucune attaque de monstre ciblée n'aboutissait en
 * français.
 */
async function loadMonsterBlocks(supabase: TypedClient, params: { worldId: string; ruleKey: string; locale: Locale }): Promise<MonsterBlocks | null> {
  const entry = await getRuleEntryForWorld(supabase, params.worldId, params.ruleKey, params.locale);
  if (!entry) return null;
  const bloc = (type: string) => entry.blocks.find((b) => b.blockType === type)?.data;
  const stat = zStatBlockBlockData.safeParse(bloc("stat_block"));
  const actions = zActionsBlockData.safeParse(bloc("actions"));
  const legendary = zLegendaryActionsBlockData.safeParse(bloc("legendary_actions"));
  return {
    statBlock: stat.success ? stat.data : null,
    actions: [...(actions.success ? actions.data.actions : []), ...(legendary.success ? legendary.data.actions : [])],
  };
}

/** Un jet du MJ pour un monstre : enregistré (V3.1-89), caché s'il est secret. */
async function recordMonsterRoll(
  supabase: TypedClient,
  params: {
    campaignId: string;
    entityId: string | null;
    kind: "attack" | "damage" | "save";
    secret: boolean;
    roll: { expression: string; ast: unknown; total: number; trace: AttackRollResult["trace"] };
    who: string;
    what: string;
  }
): Promise<void> {
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId: params.campaignId,
    expression: params.roll.expression,
    ast: params.roll.ast as Json,
    context: {},
    result: params.roll.total,
    detail: { who: params.who, what: params.what, trace: params.roll.trace } as unknown as Json,
    rolledBy: "gm",
    visibilityLevel: params.secret ? "gm" : "public",
    attribution: {
      entityId: params.entityId,
      kind: params.kind,
      ...(params.kind === "damage" ? {} : { naturalD20: naturalD20FromTrace(params.roll.trace) }),
    },
  });
}

/** Le bonus de sauvegarde d'une cible : un PJ par sa fiche, un monstre par son bloc de stats, sinon 0 (et on le dit). */
export async function targetSaveBonus(
  supabase: TypedClient,
  params: { target: CombatParticipantRow; isPc: boolean; ability: string; campaignId: string; worldId: string; locale: Locale }
): Promise<{ bonus: number; hint: string | null }> {
  const ability = params.ability.toLowerCase();
  if (params.target.entity_id && params.isPc) {
    const ctx = await resolveCharacterActionContext(supabase, params.target.entity_id, params.campaignId, params.locale);
    const save = ctx?.sheet.savingThrows[ability as keyof typeof ctx.sheet.savingThrows];
    if (save) return { bonus: save.mod, hint: null };
  }
  if (params.target.rule_key) {
    const monster = await loadMonsterBlocks(supabase, { worldId: params.worldId, ruleKey: params.target.rule_key, locale: params.locale });
    if (monster?.statBlock) return { bonus: monsterSaveBonus(monster.statBlock, ability), hint: null };
  }
  return { bonus: 0, hint: `Sauvegarde de ${params.target.label} sans fiche ni bloc de stats : bonus compté à 0.` };
}

/**
 * V3.1-110 — le profil d'une cible pour `isValidTarget` : un PJ est humanoïde
 * (toutes les espèces jouables le sont), un monstre a le type et les
 * immunités de son bloc de stats, une saisie libre n'a pas de type connu.
 */
async function targetProfileFor(supabase: TypedClient, params: { target: CombatParticipantRow; isPc: boolean; worldId: string; locale: Locale }): Promise<TargetProfile> {
  if (params.isPc) return { creatureType: "humanoid", conditionImmunities: [] };
  if (params.target.rule_key) {
    const monster = await loadMonsterBlocks(supabase, { worldId: params.worldId, ruleKey: params.target.rule_key, locale: params.locale });
    if (monster?.statBlock) {
      return { creatureType: creatureTypeOf(monster.statBlock.creature_type), conditionImmunities: monster.statBlock.condition_immunities ?? [] };
    }
  }
  return { creatureType: null, conditionImmunities: [] };
}

/**
 * Résout un jet ciblé contre un participant du combat EN COURS, et l'applique.
 *
 * Réservé au MJ dans ce ticket (garde de la route) : l'écriture d'un joueur
 * sur une cible qu'il ne contrôle pas attend les changements signés (ADR
 * 0041, V3.1-104).
 *
 * - `attack` (arme ou action de monstre) : le verdict contre la CA ; une
 *   touche renvoie une demande de dégâts chaînée (`chained`).
 * - `damage` : les dés de l'action, doublés au critique, appliqués à la cible.
 * - `spell_attack` : l'attaque de sort, puis `castSpell` — l'emplacement est
 *   dépensé même sur un échec, les dégâts ne sont lancés que sur une touche.
 * - `spell_save` : la cible sauvegarde contre le DD de sorts du lanceur ;
 *   dégâts pleins, moitié ou rien selon le sort.
 * - `heal` : la formule du sort, en soins.
 */
export async function resolveTargetedRoll(
  supabase: TypedClient,
  params: {
    campaignId: string;
    combatId: string;
    callerId: string;
    locale: Locale;
    input: TargetedRollInput & {
      /** V3.1-107 : la demande de dégâts d'un joueur présente le jeton signé de son attaque qui a touché. */
      damageToken?: string;
    };
    /** V3.1-104 : `false` pour un joueur — ce qui n'est pas à lui s'écrit par un changement signé. Absent : le MJ, écriture directe. */
    callerIsGm?: boolean;
  }
): Promise<TargetedRollResult> {
  const { input } = params;
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat || combat.campaign_id !== params.campaignId || combat.status !== "running") return { ok: false, reason: "not_running" };

  // V3.1-107 (ADR 0069) : un joueur ne lit pas les participants ; le moteur les lit par une demande signée.
  const joueur = params.callerIsGm === false;
  const participantsSignes = joueur ? await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: combat.id }) : null;
  const target = participantsSignes ? (participantsSignes.find((p) => p.id === input.targetId) ?? null) : await getCombatParticipantById(supabase, input.targetId);
  if (!target || target.combat_id !== combat.id) return { ok: false, reason: "target_not_found" };
  if (joueur && input.actor.kind !== "character") return { ok: false, reason: "actor_not_found" };
  // V3.1-107 : des dégâts au nom d'un joueur ne viennent que d'une attaque qui a touché (jeton signé), une seule fois.
  let jetonDegats: JetonDegats | null = null;
  if (joueur && input.kind === "damage") {
    jetonDegats = input.damageToken ? verifyDamageToken(input.damageToken, engineSigningKeyFromEnv()) : null;
    const memeAttaque =
      jetonDegats !== null &&
      input.actor.kind === "character" &&
      jetonDegats.actor === input.actor.entityId &&
      jetonDegats.target === target.id &&
      jetonDegats.action === canonicalJson(input.action);
    if (!memeAttaque) return { ok: false, reason: "invalid_action" };
  }
  const critique = joueur ? (jetonDegats?.critical ?? false) : input.critical;

  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_running" };

  // Sans session, le combat ne journalise rien et « Annuler » n'aurait rien à défaire.
  const sessionId = combat.session_id ?? (await getOrOpenSessionForCampaign(supabase, params.campaignId));
  // Le combat s'écrit par le MJ seul : un joueur ouvre la session sans la noter sur le combat.
  if (!combat.session_id && !joueur) await updateCombat(supabase, combat.id, { sessionId });

  const campaignCharacters = (await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc);
  const pcEntityIds = new Set(campaignCharacters.map((c) => c.entity_id));
  const targetKey = `participant:${target.id}`;
  const targetIsPc = target.entity_id !== null && pcEntityIds.has(target.entity_id);

  // L'acteur : un personnage (sa fiche), ou un participant du combat (un monstre et son bloc de stats).
  let ctx: CharacterActionContext | null = null;
  let actorParticipant: CombatParticipantRow | null = null;
  let monster: MonsterBlocks | null = null;
  if (input.actor.kind === "character") {
    ctx = await resolveCharacterActionContext(supabase, input.actor.entityId, params.campaignId, params.locale);
    if (!ctx) return { ok: false, reason: "actor_not_found" };
  } else {
    actorParticipant = await getCombatParticipantById(supabase, input.actor.participantId);
    if (!actorParticipant || actorParticipant.combat_id !== combat.id) return { ok: false, reason: "actor_not_found" };
    if (actorParticipant.rule_key) monster = await loadMonsterBlocks(supabase, { worldId: campaign.worldId, ruleKey: actorParticipant.rule_key, locale: params.locale });
  }
  const actorName = ctx?.entityName ?? actorParticipant?.label ?? "?";
  const actorTriggerKey = ctx ? ctx.entityId : null;

  const facts: string[] = [];
  const effects: ResolvedEffect[] = [];
  const hintsBefore: string[] = [];
  let verdict: AttackVerdict | null = null;
  let amount: number | null = null;
  let chained: ChainedDamage | null = null;
  let events: FiredEvent[] = [];
  let pendingSave: { ability: string; dc: number; effect: SaveRequestEffect; label: string } | null = null;
  /** Les jets à montrer dans l'outil de dés (le serveur les a lancés, règle 8). */
  const shown: { total: number; trace: TraceStep[] }[] = [];

  const action = input.action;
  const monsterAction = action.kind === "monster_action" ? (monster?.actions.find((a) => a.name === action.name) ?? null) : null;

  if (input.kind === "attack") {
    let attack: AttackRollResult;
    let label: string;
    if (action.kind === "weapon" && ctx) {
      const rolled = await rollWeaponAttack(supabase, { entityId: ctx.entityId, campaignId: params.campaignId, itemId: action.itemId, advantage: input.advantage, locale: params.locale });
      if ("error" in rolled) return { ok: false, reason: rolled.error };
      if (!rolled.attack) return { ok: false, reason: "not_a_weapon" };
      attack = rolled.attack;
      label = rolled.weaponLabel;
      shown.push(attack);
    } else if (action.kind === "monster_action" && monsterAction && monsterAction.attack_bonus !== undefined) {
      attack = resolveAttackRoll({ abilityMod: 0, proficiencyBonus: monsterAction.attack_bonus, proficient: true, advantage: input.advantage }, serverRng);
      label = monsterAction.name;
      shown.push(attack);
      await recordMonsterRoll(supabase, { campaignId: params.campaignId, entityId: actorParticipant?.entity_id ?? null, kind: "attack", secret: input.secret, roll: attack, who: actorName, what: `Attaque — ${label}` });
    } else {
      return { ok: false, reason: action.kind === "monster_action" ? "no_attack" : "invalid_action" };
    }
    verdict = attackVerdict(attack, target.ac);
    facts.push(
      joueur
        ? attackFactForPlayer({ actor: actorName, target: target.label, label, total: attack.total, verdict: target.ac === null ? null : verdict, critical: attack.isCritical, criticalFail: attack.isCriticalFail })
        : `${actorName} attaque ${target.label} (${label}) : ${attack.total}` +
            (target.ac === null ? " — CA inconnue, la table tranche" : ` contre CA ${target.ac} — ${verdict === "hit" ? "touché" : "raté"}`) +
            (attack.isCritical ? " (critique)" : attack.isCriticalFail ? " (échec critique)" : "") +
            "."
    );
    if (actorTriggerKey && target.ac !== null) events = eventsForAttack({ attacker: actorTriggerKey, target: targetKey, result: attack, ac: target.ac });
    if (verdict === "hit") {
      chained = {
        kind: "damage",
        actor: input.actor,
        action,
        targetId: target.id,
        critical: attack.isCritical,
        ...(joueur && input.actor.kind === "character"
          ? { token: signDamageToken({ actorEntityId: input.actor.entityId, action, targetId: target.id, critical: attack.isCritical }, engineSigningKeyFromEnv()) }
          : {}),
      };
    }
  } else if (input.kind === "damage") {
    let total: number;
    let damageType: string | undefined;
    if (action.kind === "weapon" && ctx) {
      const rolled = await rollWeaponDamage(supabase, { entityId: ctx.entityId, campaignId: params.campaignId, itemId: action.itemId, critical: critique, versatile: false, locale: params.locale });
      if ("error" in rolled) return { ok: false, reason: rolled.error };
      if (!rolled.damage) return { ok: false, reason: "not_a_weapon" };
      total = rolled.damage.total;
      shown.push(rolled.damage);
    } else if (action.kind === "monster_action" && monsterAction?.damage && monsterAction.damage.length > 0) {
      total = 0;
      for (const part of monsterAction.damage) {
        const roll = resolveDamageRoll({ formula: formatFormulaNode(part.dice), critical: critique }, serverRng);
        await recordMonsterRoll(supabase, { campaignId: params.campaignId, entityId: actorParticipant?.entity_id ?? null, kind: "damage", secret: input.secret, roll, who: actorName, what: `Dégâts — ${monsterAction.name}` });
        total += roll.total;
        shown.push(roll);
        damageType ??= part.type;
      }
    } else {
      return { ok: false, reason: "no_formula" };
    }
    amount = total;
    facts.push(`Dégâts sur ${target.label} : ${total}${critique ? " (critique)" : ""}.`);
    effects.push({ action: "deal_damage", who: targetKey, amount: total, ...(damageType ? { damage_type: damageType } : {}), critical: critique });
    if (actorTriggerKey) events = eventsForDamage({ attacker: actorTriggerKey, target: targetKey, damage: total, critical: critique });
  } else {
    // Les trois genres de sort : un personnage, un sort connu.
    if (action.kind !== "spell" || !ctx) return { ok: false, reason: "invalid_action" };
    // V3.1-110 : la cible est vérifiée AVANT de lancer — un refus ne dépense pas d'emplacement.
    const mechanics = await readSpellMechanics(supabase, { rulesetId: ctx.rulesetId, spellKey: action.spellKey });
    if (mechanics?.target) {
      const profile = await targetProfileFor(supabase, { target, isPc: targetIsPc, worldId: campaign.worldId, locale: params.locale });
      const check = isValidTarget({ target: mechanics.target }, profile);
      if (!check.ok) return { ok: false, reason: "invalid_target", detail: { refusal: check.reason, value: check.detail } };
    }
    const castBase = { entityId: ctx.entityId, campaignId: params.campaignId, spellKey: action.spellKey, slotLevel: action.slotLevel, actorUserId: params.callerId, locale: params.locale };

    if (input.kind === "spell_attack") {
      const rolled = await rollSpellAttack(supabase, { entityId: ctx.entityId, campaignId: params.campaignId, spellKey: action.spellKey, advantage: input.advantage, locale: params.locale });
      if ("error" in rolled) return { ok: false, reason: rolled.error };
      shown.push(rolled.attack);
      verdict = attackVerdict(rolled.attack, target.ac);
      const cast = await castSpell(supabase, { ...castBase, critical: rolled.attack.isCritical, rollDamage: verdict === "hit" });
      if ("error" in cast) return { ok: false, reason: cast.error };
      facts.push(
        joueur
          ? attackFactForPlayer({ actor: actorName, target: target.label, label: action.spellKey, total: rolled.attack.total, verdict: target.ac === null ? null : verdict, critical: rolled.attack.isCritical, criticalFail: rolled.attack.isCriticalFail })
          : `${actorName} lance ${action.spellKey} sur ${target.label} : ${rolled.attack.total}` +
              (target.ac === null ? " — CA inconnue, la table tranche" : ` contre CA ${target.ac} — ${verdict === "hit" ? "touché" : "raté"}`) +
              "."
      );
      if (verdict === "hit" && cast.damage) {
        amount = cast.damage.total;
        facts.push(`Dégâts sur ${target.label} : ${amount}${rolled.attack.isCritical ? " (critique)" : ""}.`);
        effects.push({ action: "deal_damage", who: targetKey, amount, critical: rolled.attack.isCritical });
      }
      if (target.ac !== null) events = eventsForAttack({ attacker: ctx.entityId, target: targetKey, result: rolled.attack, ac: target.ac, damage: amount ?? undefined });
    } else if (input.kind === "spell_save") {
      // V3.1-111 (ADR 0044) : la cible RÉSISTE — on lance le sort et ses
      // dégâts, on fige les deux issues, et on DEMANDE la sauvegarde au
      // joueur de la cible (ou au MJ). Rien n'est appliqué ici.
      const dc = ctx.sheet.spellcasting?.saveDc;
      if (!mechanics?.save || dc === undefined) return { ok: false, reason: "no_save_data" };
      const cast = await castSpell(supabase, { ...castBase, critical: false });
      if ("error" in cast) return { ok: false, reason: cast.error };
      const rolledDamage = cast.damage?.total ?? 0;
      const ability = mechanics.save.ability.toLowerCase();
      const imposed = mechanics.target?.immune_conditions_block ?? [];
      // V3.1-112 : le libellé se lit sur le bandeau de la cible (« Résiste à
      // Moquerie cruelle · JS Sagesse DD 13 ») : le nom traduit du sort, pas sa clé.
      const spellName = (await getRuleEntryForWorld(supabase, campaign.worldId, action.spellKey, params.locale))?.name ?? action.spellKey;
      const abilityLabel = ABILITY_LABELS[ability as Ability] ?? ability.toUpperCase();
      pendingSave = {
        ability,
        dc,
        label: `${spellName} · JS ${abilityLabel} DD ${dc}`,
        effect: zSaveRequestEffect.parse({
          on_fail: { damage: rolledDamage, conditions: imposed },
          on_success: { damage: damageAfterSave(rolledDamage, true, mechanics.save.effectOnSuccess), conditions: [] },
        }),
      };
      amount = cast.damage ? rolledDamage : null;
      facts.push(
        `${actorName} lance ${spellName} sur ${target.label} : sauvegarde ${ability.toUpperCase()} DD ${dc} demandée` +
          (cast.damage ? ` (dégâts lancés : ${rolledDamage})` : "") +
          "."
      );
    } else {
      if (!mechanics?.hasFormula) return { ok: false, reason: "no_formula" };
      const cast = await castSpell(supabase, { ...castBase, critical: false });
      if ("error" in cast) return { ok: false, reason: cast.error };
      if (!cast.damage) return { ok: false, reason: "no_formula" };
      amount = cast.damage.total;
      facts.push(`${actorName} soigne ${target.label} (${action.spellKey}) : ${amount}.`);
      effects.push({ action: "heal", who: targetKey, amount });
    }
  }

  // Le fait, journalisé AVANT toute application : si la suite tombe, le jet reste acquis.
  const seq = await nextEventSeq(supabase, sessionId);
  const rollEvent = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "roll",
    actor: "gm",
    actorUserId: params.callerId,
    payload: {
      __v: 1,
      targeted: { kind: input.kind, actor: input.actor, action, target_id: target.id, target_label: target.label, verdict, amount, critical: critique },
      facts,
    } as unknown as Json,
  });

  if (pendingSave && joueur) return { ok: false, reason: "save_gm_only" };
  if (pendingSave) {
    const targetUserId = target.entity_id ? (campaignCharacters.find((c) => c.entity_id === target.entity_id)?.user_id ?? null) : null;
    const request = await insertSaveRequest(supabase, {
      campaignId: params.campaignId,
      combatId: combat.id,
      originRollId: rollEvent.id,
      targetKind: "participant",
      targetId: target.id,
      targetEntityId: target.entity_id,
      targetUserId,
      label: pendingSave.label,
      ability: pendingSave.ability,
      dc: pendingSave.dc,
      effect: pendingSave.effect as unknown as Json,
    });
    return {
      ok: true,
      verdict: null,
      amount,
      facts,
      changes: [],
      hints: hintsBefore,
      ignored: [],
      targetOutOfFight: false,
      chained: null,
      rollEventId: rollEvent.id,
      saveRequestId: request.id,
      dice: rollsForDisplay(shown),
    };
  }

  if (ctx && actorTriggerKey) {
    effects.push(...(await fireActorTriggers(supabase, { ctx, actorEntityId: actorTriggerKey, campaignId: params.campaignId, events, scene: null })));
  }

  const outcome = await applyResolvedEffects(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    actor: ctx ? { entityId: ctx.entityId, name: ctx.entityName, hpMax: ctx.sheet.hitPoints.max, speed: ctx.sheet.speed.value } : null,
    scene: null,
    spend: null,
    effects,
    note: `Cibler — ${facts[0] ?? input.kind}`,
    fromEventId: rollEvent.id,
    combatId: combat.id,
    ...(joueur && participantsSignes
      ? { signedWrites: { ownEntityIds: new Set(ctx ? [ctx.entityId] : []), ...(jetonDegats ? { nonce: jetonDegats.nonce } : {}) }, participants: participantsSignes }
      : {}),
  });

  const targetAfter = outcome.applied.state.actors[targetKey];
  const targetOutOfFight = targetAfter
    ? isOutOfFight({ isPc: targetIsPc, hpCurrent: targetAfter.hp.current, hpMax: target.hp_max })
    : false;

  return {
    ok: true,
    verdict,
    amount,
    facts: targetOutOfFight ? [...facts, `${target.label} est hors de combat.`] : facts,
    changes: outcome.changes,
    hints: [...hintsBefore, ...outcome.hints],
    ignored: outcome.ignored,
    targetOutOfFight,
    chained,
    rollEventId: rollEvent.id,
    saveRequestId: null,
    dice: rollsForDisplay(shown),
  };
}
