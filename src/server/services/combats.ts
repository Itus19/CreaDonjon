import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  abilityModifier,
  advanceTurn,
  retreatTurn,
  rollInitiative,
  sortByInitiative,
  startCombat as computeStartCombat,
  type CombatParticipantOrder,
} from "@/src/core/rules/combat";
import type { Rng } from "@/src/core/dice/rng";
import { mergeRuntimeState, type RuntimeStatePatch } from "@/src/core/rules/runtimeState";
import { zRuntimeState } from "@/src/core/schemas/runtimeState";
import type { StatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import {
  deleteCombatParticipant,
  getActiveCombatForCampaign,
  getCombatById,
  getCombatParticipantById,
  insertCombat,
  insertCombatParticipant,
  listCombatParticipants,
  listCombatsForCampaign,
  updateCombat,
  updateCombatParticipant,
  type CombatParticipantRow,
  type CombatRow,
} from "@/src/server/repos/combats";
import { getRulesetEntryByKey, listBlocksForRulesetEntry, listRulesetEntries, listTranslationsForEntries } from "@/src/server/repos/rules";
import { entryNameFrom } from "@/src/server/services/rules";
import { getEntityById } from "@/src/server/repos/entities";
import { putRuntimeState } from "@/src/server/repos/runtimeState";
import { nextEventSeq, insertSessionEvent } from "@/src/server/repos/sessions";
import { getCampaign } from "@/src/server/services/campaigns";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Ordonne des participants par initiative (noyau pur `sortByInitiative`) sans perdre la ligne complete — adapte snake_case (base) vers camelCase (coeur) a la frontiere, jamais l'inverse. */
export function orderParticipants(rows: readonly CombatParticipantRow[]): CombatParticipantRow[] {
  const orderable = rows.map((row): CombatParticipantOrder & { row: CombatParticipantRow } => ({
    id: row.id,
    initiative: row.initiative,
    displayOrder: row.display_order,
    row,
  }));
  return sortByInitiative(orderable).map((o) => o.row);
}

/** CA/PV max d'un monstre du ruleset, lus depuis son bloc `stat_block` deja extrait — `null` si l'entree ou son bloc sont introuvables (ruleset custom sans ce monstre). */
async function getMonsterCombatStats(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<{ ac: number; hpMax: number; dexMod: number } | null> {
  const entry = await getRulesetEntryByKey(supabase, rulesetId, entryKey);
  if (!entry) return null;
  const blocks = await listBlocksForRulesetEntry(supabase, entry.id);
  const statBlock = blocks.find((b) => b.block_type === "stat_block");
  if (!statBlock) return null;
  const data = statBlock.data as unknown as StatBlockBlockData;
  return { ac: data.armor_class, hpMax: data.hit_points, dexMod: abilityModifier(data.abilities.dex) };
}

async function dexModifierForParticipant(
  supabase: TypedClient,
  participant: CombatParticipantRow,
  campaignId: string,
  locale: Locale
): Promise<number> {
  if (participant.source_kind === "entity" && participant.entity_id) {
    const ctx = await resolveCharacterActionContext(supabase, participant.entity_id, campaignId, locale);
    return ctx?.sheet.abilities.dex.mod ?? 0;
  }
  if (participant.source_kind === "statblock" && participant.rule_key) {
    const campaign = await getCampaign(supabase, campaignId);
    if (!campaign) return 0;
    const stats = await getMonsterCombatStats(supabase, campaign.rulesetId, participant.rule_key);
    return stats?.dexMod ?? 0;
  }
  return 0; // saisie libre (piege...) : le MJ fixe l'initiative a la main.
}

interface CombatEventPayload {
  combatId: string;
  target: "combat" | "participant";
  targetId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  note: string;
  is_undo?: boolean;
  undoes?: string;
}

/** Journalise une modification de combat (specs/outils-mj.md §5.3) — rien a journaliser sans session ouverte (jamais le cas en pratique, une session s'ouvre au premier jet de la campagne). */
async function journalCombatEvent(
  supabase: TypedClient,
  combat: CombatRow,
  params: { target: "combat" | "participant"; targetId: string; before: unknown; after: unknown; note: string; actorUserId: string }
): Promise<void> {
  if (!combat.session_id) return;
  const seq = await nextEventSeq(supabase, combat.session_id);
  const payload: CombatEventPayload = {
    combatId: combat.id,
    target: params.target,
    targetId: params.targetId,
    before: params.before as Record<string, unknown>,
    after: params.after as Record<string, unknown>,
    note: params.note,
  };
  await insertSessionEvent(supabase, {
    sessionId: combat.session_id,
    seq,
    kind: "combat",
    actor: "gm",
    actorUserId: params.actorUserId,
    payload: payload as unknown as Json,
  });
}

export interface StartCombatMonsterInput {
  entryKey: string;
  label: string;
  count: number;
}

async function nextDisplayOrder(supabase: TypedClient, combatId: string): Promise<number> {
  const participants = await listCombatParticipants(supabase, combatId);
  return participants.length > 0 ? Math.max(...participants.map((p) => p.display_order)) + 1 : 1;
}

/** Insere une composition de monstres comme participants, numerotes s'il y en a plusieurs du meme type ("Gobelin 1", "Gobelin 2"...), CA/PV lus depuis leur bloc `stat_block`. Partagee entre la creation d'un combat et l'ajout a un combat existant (meme insertion, seul le point de depart de `display_order` change). */
async function insertMonsterParticipants(
  supabase: TypedClient,
  params: { combatId: string; rulesetId: string; monsters: readonly StartCombatMonsterInput[]; startOrder: number }
): Promise<void> {
  let order = params.startOrder;
  for (const monster of params.monsters) {
    const stats = await getMonsterCombatStats(supabase, params.rulesetId, monster.entryKey);
    for (let i = 1; i <= monster.count; i++) {
      order += 1;
      await insertCombatParticipant(supabase, {
        combatId: params.combatId,
        sourceKind: "statblock",
        entityId: null,
        ruleKey: monster.entryKey,
        label: monster.count > 1 ? `${monster.label} ${i}` : monster.label,
        ac: stats?.ac ?? null,
        hpMax: stats?.hpMax ?? null,
        hpCurrent: stats?.hpMax ?? null,
        isAlly: false,
        displayOrder: order,
      });
    }
  }
}

/**
 * Cree un combat (statut `draft`) depuis une composition de monstres — le
 * point d'entree du bouton "Lancer le combat" de l'outil Rencontres
 * (V1-E3), quand la campagne n'a pas deja de combat en cours (sinon
 * `addMonstersToCombat`, retour utilisateur : exporter une nouvelle
 * generation dans l'ecran Initiative ne doit pas fragmenter le combat en
 * cours). Les PJ ne sont PAS ajoutes automatiquement — le MJ les ajoute
 * depuis l'ecran d'initiative (`addEntityParticipant`).
 */
export async function createCombatFromMonsters(
  supabase: TypedClient,
  params: { campaignId: string; rulesetId: string; name: string | null; monsters: readonly StartCombatMonsterInput[] }
): Promise<CombatRow> {
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const combat = await insertCombat(supabase, { campaignId: params.campaignId, sessionId, name: params.name });
  await insertMonsterParticipants(supabase, { combatId: combat.id, rulesetId: params.rulesetId, monsters: params.monsters, startOrder: 0 });
  return combat;
}

/** Exporte une composition de monstres dans un combat DEJA EN COURS (draft ou en cours) — retour explicite de l'utilisateur : generer une nouvelle rencontre doit pouvoir l'ajouter au combat affiche dans l'ecran Initiative plutot que d'en creer un second qui l'abandonne. */
export async function addMonstersToCombat(
  supabase: TypedClient,
  params: { combatId: string; rulesetId: string; monsters: readonly StartCombatMonsterInput[] }
): Promise<void> {
  const startOrder = (await nextDisplayOrder(supabase, params.combatId)) - 1;
  await insertMonsterParticipants(supabase, { combatId: params.combatId, rulesetId: params.rulesetId, monsters: params.monsters, startOrder });
}

/** Ajoute un PJ/PNJ nomme (entite du monde) au combat — CA/PV lus depuis sa fiche derivee, PV courants depuis `entity_runtime_state` (jamais une copie figee : c'est la meme source que la fiche jouable). */
export async function addEntityParticipant(
  supabase: TypedClient,
  params: { combatId: string; entityId: string; campaignId: string; locale: Locale; isAlly: boolean }
): Promise<CombatParticipantRow | null> {
  const [entity, ctx, state] = await Promise.all([
    getEntityById(supabase, params.entityId),
    resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale),
    getEntityRuntimeState(supabase, params.entityId, params.campaignId),
  ]);
  if (!entity || !ctx) return null;

  return insertCombatParticipant(supabase, {
    combatId: params.combatId,
    sourceKind: "entity",
    entityId: params.entityId,
    ruleKey: null,
    label: entity.name,
    ac: ctx.sheet.ac.value,
    hpMax: ctx.sheet.hitPoints.max,
    hpCurrent: state.hp.current,
    isAlly: params.isAlly,
    displayOrder: await nextDisplayOrder(supabase, params.combatId),
  });
}

/** Ajoute un monstre du ruleset (hors composition initiale — un renfort en cours de combat). */
export async function addStatblockParticipant(
  supabase: TypedClient,
  params: { combatId: string; campaignId: string; entryKey: string; label: string; isAlly: boolean }
): Promise<CombatParticipantRow | null> {
  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return null;
  const stats = await getMonsterCombatStats(supabase, campaign.rulesetId, params.entryKey);
  return insertCombatParticipant(supabase, {
    combatId: params.combatId,
    sourceKind: "statblock",
    entityId: null,
    ruleKey: params.entryKey,
    label: params.label,
    ac: stats?.ac ?? null,
    hpMax: stats?.hpMax ?? null,
    hpCurrent: stats?.hpMax ?? null,
    isAlly: params.isAlly,
    displayOrder: await nextDisplayOrder(supabase, params.combatId),
  });
}

/** Saisie libre (le piege qui agit a l'initiative 20, un PNJ sans fiche) — aucune CA/PV connus, le MJ les saisit a la main ensuite. */
export async function addCustomParticipant(
  supabase: TypedClient,
  params: { combatId: string; label: string; isAlly: boolean }
): Promise<CombatParticipantRow> {
  return insertCombatParticipant(supabase, {
    combatId: params.combatId,
    sourceKind: "custom",
    entityId: null,
    ruleKey: null,
    label: params.label,
    ac: null,
    hpMax: null,
    hpCurrent: null,
    isAlly: params.isAlly,
    displayOrder: await nextDisplayOrder(supabase, params.combatId),
  });
}

/** Retrait d'un participant — jamais suivi par l'annulation (Ctrl/Z) : reinserer casserait la reference d'id des evenements suivants. Portee volontairement reduite. */
export async function removeParticipant(supabase: TypedClient, participantId: string): Promise<void> {
  await deleteCombatParticipant(supabase, participantId);
}

/** Un seul jet, pour un participant precis (bouton "relancer l'initiative" au survol). */
export async function rollParticipantInitiative(
  supabase: TypedClient,
  params: { participantId: string; campaignId: string; locale: Locale; rng: Rng }
): Promise<CombatParticipantRow | null> {
  const participant = await getCombatParticipantById(supabase, params.participantId);
  if (!participant) return null;
  const dexMod = await dexModifierForParticipant(supabase, participant, params.campaignId, params.locale);
  return updateCombatParticipant(supabase, participant.id, { initiative: rollInitiative(dexMod, params.rng) });
}

/** "Lancer toutes les initiatives" — un seul appel serveur, un jet independant par participant (specs/outils-mj.md §5.4). */
export async function rollAllInitiatives(
  supabase: TypedClient,
  params: { combatId: string; campaignId: string; locale: Locale; rng: Rng }
): Promise<CombatParticipantRow[]> {
  const participants = await listCombatParticipants(supabase, params.combatId);
  const updated: CombatParticipantRow[] = [];
  for (const participant of participants) {
    const dexMod = await dexModifierForParticipant(supabase, participant, params.campaignId, params.locale);
    updated.push(await updateCombatParticipant(supabase, participant.id, { initiative: rollInitiative(dexMod, params.rng) }));
  }
  return updated;
}

/** Passe le combat en `running`, initiative deja lancee — round 1, premier participant de l'ordre trie. */
export async function beginCombat(
  supabase: TypedClient,
  params: { combatId: string; actorUserId: string }
): Promise<CombatRow> {
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat) throw new Error("Combat introuvable.");
  const participants = await listCombatParticipants(supabase, params.combatId);
  const turn = computeStartCombat(participants.length);
  const updated = await updateCombat(supabase, params.combatId, { round: turn.round, turnIndex: turn.turnIndex, status: "running" });
  await journalCombatEvent(supabase, combat, {
    target: "combat",
    targetId: combat.id,
    before: { round: combat.round, turn_index: combat.turn_index, status: combat.status },
    after: { round: updated.round, turn_index: updated.turn_index, status: updated.status },
    note: "Combat lance",
    actorUserId: params.actorUserId,
  });
  return updated;
}

export async function endCombat(supabase: TypedClient, params: { combatId: string; actorUserId: string }): Promise<CombatRow> {
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat) throw new Error("Combat introuvable.");
  const updated = await updateCombat(supabase, params.combatId, { status: "ended" });
  await journalCombatEvent(supabase, combat, {
    target: "combat",
    targetId: combat.id,
    before: { round: combat.round, turn_index: combat.turn_index, status: combat.status },
    after: { round: updated.round, turn_index: updated.turn_index, status: updated.status },
    note: "Combat termine",
    actorUserId: params.actorUserId,
  });
  return updated;
}

async function moveTurn(
  supabase: TypedClient,
  params: { combatId: string; actorUserId: string; direction: "next" | "previous" }
): Promise<CombatRow> {
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat) throw new Error("Combat introuvable.");
  const participants = await listCombatParticipants(supabase, params.combatId);
  const current = { round: combat.round, turnIndex: combat.turn_index };
  const next = params.direction === "next" ? advanceTurn(current, participants.length) : retreatTurn(current, participants.length);
  const updated = await updateCombat(supabase, params.combatId, { round: next.round, turnIndex: next.turnIndex });
  await journalCombatEvent(supabase, combat, {
    target: "combat",
    targetId: combat.id,
    before: { round: combat.round, turn_index: combat.turn_index, status: combat.status },
    after: { round: updated.round, turn_index: updated.turn_index, status: updated.status },
    note: params.direction === "next" ? "Tour suivant" : "Tour precedent",
    actorUserId: params.actorUserId,
  });
  return updated;
}

export const advanceCombatTurn = (supabase: TypedClient, params: { combatId: string; actorUserId: string }) =>
  moveTurn(supabase, { ...params, direction: "next" });
export const retreatCombatTurn = (supabase: TypedClient, params: { combatId: string; actorUserId: string }) =>
  moveTurn(supabase, { ...params, direction: "previous" });

export interface ParticipantPatchInput {
  initiative?: number;
  ac?: number;
  hpCurrent?: number;
  tempHp?: number;
  conditions?: string[];
  concentration?: { label: string } | null;
}

/**
 * Modifie PV/PV-temp/conditions/concentration d'un participant. Pour un
 * participant `entity` (PJ) : ecrit AUSSI `entity_runtime_state` (jamais
 * `applyRuntimeStateChange`, qui journaliserait un second `session_event` —
 * un seul evenement `combat` couvre les deux ecritures pour une annulation
 * coherente en un clic). La fiche jouable lit la meme ligne : elle reflete
 * le changement immediatement, retour explicite de l'utilisateur.
 */
export async function patchCombatParticipant(
  supabase: TypedClient,
  params: { participantId: string; patch: ParticipantPatchInput; actorUserId: string; note: string }
): Promise<CombatParticipantRow | null> {
  const participant = await getCombatParticipantById(supabase, params.participantId);
  if (!participant) return null;
  const combat = await getCombatById(supabase, participant.combat_id);
  if (!combat) return null;

  const before = { ...participant };

  const updated = await updateCombatParticipant(supabase, participant.id, {
    initiative: params.patch.initiative,
    ac: params.patch.ac,
    hpCurrent: params.patch.hpCurrent,
    tempHp: params.patch.tempHp,
    conditions: params.patch.conditions as unknown as Json | undefined,
    concentration: params.patch.concentration === undefined ? undefined : ((params.patch.concentration ?? null) as unknown as Json),
  });

  if (participant.source_kind === "entity" && participant.entity_id) {
    const state = await getEntityRuntimeState(supabase, participant.entity_id, combat.campaign_id);
    const rtPatch: RuntimeStatePatch = {};
    if (params.patch.hpCurrent !== undefined || params.patch.tempHp !== undefined) {
      rtPatch.hp = { current: params.patch.hpCurrent ?? state.hp.current, temp: params.patch.tempHp ?? state.hp.temp };
    }
    if (params.patch.conditions !== undefined) rtPatch.conditions = params.patch.conditions;
    if (Object.keys(rtPatch).length > 0) {
      const next = mergeRuntimeState(state, rtPatch);
      zRuntimeState.parse(next);
      await putRuntimeState(supabase, { entityId: participant.entity_id, campaignId: combat.campaign_id, state: next as unknown as Json });
    }
  }

  await journalCombatEvent(supabase, combat, {
    target: "participant",
    targetId: participant.id,
    before,
    after: updated,
    note: params.note,
    actorUserId: params.actorUserId,
  });

  return updated;
}

/**
 * Annule la derniere modification de combat non deja annulee
 * (specs/outils-mj.md §5.3) — jamais une suppression du journal, une
 * nouvelle entree `is_undo` qui reapplique l'etat `before`. Un evenement
 * deja cible par un `undoes` est ecarte de la recherche : un deuxieme clic
 * remonte plus loin, jamais un aller-retour sur la meme action.
 */
export async function undoLastCombatAction(supabase: TypedClient, combatId: string, actorUserId: string): Promise<boolean> {
  const combat = await getCombatById(supabase, combatId);
  if (!combat?.session_id) return false;

  const { data, error } = await supabase
    .from("session_events")
    .select("id, seq, payload")
    .eq("session_id", combat.session_id)
    .eq("kind", "combat")
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);

  const events = (data ?? [])
    .map((e) => ({ id: e.id as string, payload: e.payload as unknown as CombatEventPayload }))
    .filter((e) => e.payload.combatId === combatId);

  const undoneIds = new Set(events.filter((e) => e.payload.undoes).map((e) => e.payload.undoes as string));
  const undoable = events.filter((e) => !e.payload.is_undo && !undoneIds.has(e.id));
  const last = undoable[undoable.length - 1];
  if (!last) return false;

  if (last.payload.target === "combat") {
    const before = last.payload.before as { round: number; turn_index: number; status: string };
    await updateCombat(supabase, combatId, { round: before.round, turnIndex: before.turn_index, status: before.status });
  } else {
    const before = last.payload.before as unknown as CombatParticipantRow;
    await updateCombatParticipant(supabase, last.payload.targetId, {
      initiative: before.initiative,
      hpCurrent: before.hp_current,
      tempHp: before.temp_hp,
      conditions: before.conditions,
      concentration: before.concentration,
    });
    const participant = await getCombatParticipantById(supabase, last.payload.targetId);
    if (participant?.source_kind === "entity" && participant.entity_id) {
      const state = await getEntityRuntimeState(supabase, participant.entity_id, combat.campaign_id);
      const next = mergeRuntimeState(state, {
        hp: { current: before.hp_current ?? state.hp.current, temp: before.temp_hp ?? state.hp.temp },
        conditions: (before.conditions as unknown as string[] | undefined) ?? state.conditions,
      });
      zRuntimeState.parse(next);
      await putRuntimeState(supabase, { entityId: participant.entity_id, campaignId: combat.campaign_id, state: next as unknown as Json });
    }
  }

  const seq = await nextEventSeq(supabase, combat.session_id);
  const undoPayload: CombatEventPayload = {
    combatId,
    target: last.payload.target,
    targetId: last.payload.targetId,
    before: last.payload.after,
    after: last.payload.before,
    note: `Annulé : ${last.payload.note}`,
    is_undo: true,
    undoes: last.id,
  };
  await insertSessionEvent(supabase, {
    sessionId: combat.session_id,
    seq,
    kind: "combat",
    actor: "gm",
    actorUserId,
    payload: undoPayload as unknown as Json,
  });

  return true;
}

/** Catalogue des conditions du ruleset (entry_type "condition"), traduites — le menu deroulant "+ Condition" de l'ecran d'initiative, jamais une liste figee en dur (les deux SRD n'ont pas exactement les memes noms). */
export async function listConditionNames(supabase: TypedClient, rulesetId: string, locale: Locale): Promise<string[]> {
  const entries = await listRulesetEntries(supabase, rulesetId);
  const conditions = entries.filter((e) => e.entry_type === "condition");
  const translationByEntryId = new Map<string, string>();
  if (locale !== "en") {
    const translations = await listTranslationsForEntries(supabase, conditions.map((e) => e.id), locale);
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }
  return conditions.map((e) => translationByEntryId.get(e.id) ?? entryNameFrom(e)).sort((a, b) => a.localeCompare(b, "fr"));
}

export interface CombatDetail {
  combat: CombatRow;
  participants: CombatParticipantRow[];
}

/** Combat + ses participants tries par initiative — forme consommee directement par la page/route de detail. */
export async function getCombatDetail(supabase: TypedClient, combatId: string): Promise<CombatDetail | null> {
  const combat = await getCombatById(supabase, combatId);
  if (!combat) return null;
  const participants = orderParticipants(await listCombatParticipants(supabase, combatId));
  return { combat, participants };
}

export { getActiveCombatForCampaign, getCombatById, listCombatParticipants, listCombatsForCampaign };
