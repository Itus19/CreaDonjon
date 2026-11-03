import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { effectFromRow, expireEffects, type ActiveDurableEffect, type ExpiryEvent, type ExpiryReason } from "@/src/core/rules/durableEffects";
import { deleteFeatureEffect, listFeatureEffectsForBearers, updateFeatureEffect, type ActiveEffectRow } from "@/src/server/repos/activeEffects";
import { getActiveCombatForCampaign, listCombatParticipants, updateCombatParticipant, type CombatParticipantRow } from "@/src/server/repos/combats";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { getCampaign } from "@/src/server/services/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { applySignedEngineChange, readCombatEffectsForEngine, readCombatParticipantsSigned, type EngineChangeLine } from "@/src/server/services/engineSigning";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-130 (ADR 0060 §3, ADR 0073) — l'expiration des effets qui durent, en
 * base. La DÉCISION est celle du noyau (`expireEffects`) ; ici, on lit, on
 * écrit, on journalise. Un effet retiré l'est avec ses états (sauf si un autre
 * effet du même porteur les tient), et jamais en silence.
 *
 * Clés d'acteurs : celles de `applyResolvedEffects` — une fiche par son
 * entité, un participant par `participant:<id>`. Un PJ du combat est les deux
 * à la fois : ses effets sont rangés par entité, ses événements de combat
 * arrivent par son participant ; chaque événement est donc aussi rejoué sous
 * l'autre clé (un effet ne correspond qu'à l'une des deux : rien ne compte
 * deux fois).
 *
 * Droits : le MJ lit et écrit directement. Un joueur lit les effets du combat
 * par une demande signée et retire ce qui n'est pas à lui par `effect_remove`
 * signé ; il ne décompte jamais le temps d'un autre (les bascules de tour sont
 * au MJ).
 */

export interface ExpiredEffect {
  bearer: string;
  label: string;
  reason: ExpiryReason;
}

function bearerKey(row: ActiveEffectRow): string {
  return row.combat_participant_id ? `participant:${row.combat_participant_id}` : (row.entity_id ?? "");
}

/** Le même événement sous la clé de l'entité d'un PJ du combat (ou l'inverse). */
function aliases(ev: ExpiryEvent, pcOfParticipant: ReadonlyMap<string, string>): ExpiryEvent[] {
  const autre = (key: string) => (key.startsWith("participant:") ? pcOfParticipant.get(key.slice("participant:".length)) : undefined);
  switch (ev.kind) {
    case "turn_start":
    case "turn_end": {
      const a = autre(ev.actor);
      return a ? [ev, { ...ev, actor: a }] : [ev];
    }
    case "game_event": {
      const a = autre(ev.subject);
      return a ? [ev, { ...ev, subject: a }] : [ev];
    }
    default:
      return [ev];
  }
}

export async function expireFeatureEffects(
  supabase: TypedClient,
  params: {
    campaignId: string;
    events: readonly ExpiryEvent[];
    callerId: string;
    /** Absent : calculé (administrateur du monde de la campagne). */
    callerIsGm?: boolean;
    /** Le combat concerné ; absent : celui en cours de la campagne, s'il y en a un. */
    combatId?: string | null;
    participants?: readonly CombatParticipantRow[];
    /** Seulement les effets de ce porteur (un repos ne touche que celui qui se repose). */
    onlyBearer?: string;
    /** Le personnage de l'appelant : ce qui le porte s'écrit directement, même pour un joueur. */
    ownEntityId?: string;
  }
): Promise<ExpiredEffect[]> {
  if (params.events.length === 0) return [];
  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return [];
  const gm = params.callerIsGm ?? (await isWorldAdmin(supabase, { worldId: campaign.worldId, userId: params.callerId }));
  const combatId = params.combatId !== undefined ? params.combatId : ((await getActiveCombatForCampaign(supabase, params.campaignId))?.id ?? null);
  const characters = (await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc);

  let participants: readonly CombatParticipantRow[] = params.participants ?? [];
  if (!params.participants && combatId) {
    participants = gm ? await listCombatParticipants(supabase, combatId) : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId });
  }
  const pcIds = new Set(characters.map((c) => c.entity_id));
  const pcOfParticipant = new Map(participants.filter((p) => p.entity_id && pcIds.has(p.entity_id)).map((p) => [p.id, p.entity_id as string]));

  // Lecture : directe pour le MJ (ou sans combat : les fiches de la campagne se lisent par tout membre), signée pour un joueur en combat.
  const rows =
    !gm && combatId
      ? await readCombatEffectsForEngine(supabase, { campaignId: params.campaignId, combatId })
      : await listFeatureEffectsForBearers(supabase, { campaignId: params.campaignId, entityIds: [...pcIds], participantIds: participants.map((p) => p.id) });

  const parId = new Map<string, ActiveEffectRow>();
  let effets: ActiveDurableEffect[] = [];
  for (const row of rows) {
    const key = bearerKey(row);
    if (params.onlyBearer && key !== params.onlyBearer) continue;
    const e = effectFromRow(row, key);
    if (!e) {
      console.error("Effet actif mal formé, ignoré", row.id);
      continue;
    }
    parId.set(row.id, row);
    effets.push(e);
  }
  if (effets.length === 0) return [];
  const avant = new Map(effets.map((e) => [e.instanceId, e]));

  const partis: { effect: ActiveDurableEffect; reason: ExpiryReason }[] = [];
  for (const ev of params.events) {
    for (const alias of aliases(ev, pcOfParticipant)) {
      const r = expireEffects(effets, alias);
      effets = r.kept;
      partis.push(...r.expired);
    }
  }

  const aMoi = (e: ActiveDurableEffect) => gm || (params.ownEntityId !== undefined && e.bearer === params.ownEntityId);

  // Le temps décompté : seulement ce que l'appelant peut écrire (un joueur ne décompte que son propre personnage).
  for (const e of effets) {
    const a = avant.get(e.instanceId);
    if (!a || !aMoi(e)) continue;
    if (a.remainingRounds !== e.remainingRounds || a.untilTurnEnd?.left !== e.untilTurnEnd?.left) {
      await updateFeatureEffect(supabase, e.instanceId, {
        duration: { remainingRounds: e.remainingRounds, untilTurnEnd: e.untilTurnEnd, untilRest: e.untilRest } as unknown as Json,
      });
    }
  }
  if (partis.length === 0) return [];

  // Les retraits, et les états qu'ils tenaient (sauf ceux qu'un effet restant du même porteur tient encore).
  const signes: EngineChangeLine[] = [];
  const aRetirer = new Map<string, Set<string>>();
  for (const { effect } of partis) {
    if (aMoi(effect)) await deleteFeatureEffect(supabase, effect.instanceId);
    else signes.push({ kind: "effect_remove", id: effect.instanceId });
    for (const key of effect.conditions) {
      const tenu = effets.some((k) => k.bearer === effect.bearer && k.conditions.includes(key));
      if (!tenu) aRetirer.set(effect.bearer, new Set([...(aRetirer.get(effect.bearer) ?? []), key]));
    }
  }

  const resultat = partis.map(({ effect, reason }) => ({ bearer: effect.bearer, label: effect.label, reason }));
  const note = `Fin d'effet : ${resultat.map((r) => r.label).join(", ")}`;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);

  for (const [bearer, keys] of aRetirer) {
    const sans = (liste: readonly string[]) => liste.filter((c) => !keys.has(c));
    if (bearer.startsWith("participant:")) {
      const p = participants.find((x) => `participant:${x.id}` === bearer);
      if (!p) continue;
      const avantEtats = Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [];
      const apres = sans(avantEtats);
      if (apres.length === avantEtats.length) continue;
      if (gm) {
        const ligne = await updateCombatParticipant(supabase, p.id, { conditions: apres as unknown as Json });
        await journalParticipant(supabase, { combatId: p.combat_id, sessionId, before: p, after: ligne, note, actorUserId: params.callerId });
      } else {
        signes.push({ kind: "participant", id: p.id, conditions: apres });
      }
      continue;
    }
    // Une fiche : la sienne (ou le MJ) en direct ; un autre PJ par changement signé.
    const etat = await getEntityRuntimeState(supabase, bearer, params.campaignId);
    const apres = sans(etat.conditions);
    if (apres.length === etat.conditions.length) continue;
    if (gm || bearer === params.ownEntityId) {
      await applyRuntimeStateChange(supabase, { entityId: bearer, campaignId: params.campaignId, patch: { conditions: apres }, note, sessionId, actor: gm ? "gm" : "player", actorUserId: params.callerId });
    } else {
      signes.push({ kind: "runtime", id: bearer, conditions: apres });
    }
  }
  if (signes.length > 0) await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: signes });

  // Le journal dit ce qui est parti, même quand aucun état n'a bougé (un modificateur, un jeton).
  if (sessionId) {
    await insertSessionEvent(supabase, {
      sessionId,
      seq: await nextEventSeq(supabase, sessionId),
      kind: "rule_application",
      actor: gm ? "gm" : "player",
      actorUserId: params.callerId,
      payload: { note, effects: resultat } as unknown as Json,
    });
  }
  return resultat;
}

/** Le retrait d'un état sur une instance, au journal du combat (même forme que `journalCombatEvent`) : « Annuler » le rend. */
async function journalParticipant(
  supabase: TypedClient,
  params: { combatId: string; sessionId: string | null; before: CombatParticipantRow; after: CombatParticipantRow; note: string; actorUserId: string }
): Promise<void> {
  if (!params.sessionId) return;
  await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq: await nextEventSeq(supabase, params.sessionId),
    kind: "combat",
    actor: "gm",
    actorUserId: params.actorUserId,
    payload: { combatId: params.combatId, target: "participant", targetId: params.before.id, before: params.before, after: params.after, note: params.note } as unknown as Json,
  });
}
