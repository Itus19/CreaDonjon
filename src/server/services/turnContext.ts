import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { buildTurnContext, type TurnContextInput, type TurnContextNpc, type TurnContextQuest } from "@/src/core/ai/turnContext";
import { buildGmQuestionContext } from "@/src/core/ai/gmQuestionContext";
import { relationshipAxisLabel } from "@/src/core/psyche/bands";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listRecentEventsByKind } from "@/src/server/repos/sessions";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";

/** V3-B4 — « les *n* dernières narrations » : même n que `RECENT_EVENTS_KEPT` (`src/core/rules/scene.ts`), pas de raison d'en choisir un autre. */
export const RECENT_NARRATIONS_KEPT = 5;

type TypedClient = SupabaseClient<Database>;

/**
 * V3-B3 — Résout les entrées côté base pour `buildTurnContext` (pur,
 * `src/core/ai/turnContext.ts`) : la scène courante, les présents avec
 * `known_as` appliqué et leur bande d'attitude nommée, les quêtes actives.
 *
 * **Toujours reconstruit, jamais mis en cache d'un tour à l'autre** — trou
 * n° 2 d'ADR 0009. Chaque appel relit `scene_states` : la boucle appelle
 * cette fonction après avoir écrit la scène du tour (`playTurn`), jamais
 * avant.
 *
 * **`viewer` vient TOUJOURS de l'appelant, jamais construit ici.** C'est ce
 * qui borne le contexte par l'audience (règle absolue 11) : cette fonction
 * ne peut pas s'élever elle-même à un viewer `gm`, elle transmet
 * simplement celui qu'on lui donne à `listActiveQuestsForWorld` — qui fait
 * déjà le filtrage réel (`filterBlocks`, éprouvé par
 * `visibilityRls.integration.test.ts`).
 */

/** L'axe "attitude générale" — le même mot que "cordial"/"hostile" déjà montré ailleurs dans l'écran solo (V3-D3). Les six autres axes (mefiance, respect...) restent hors de ce contexte : plus de nuance que ce dont une narration de deux phrases a besoin. */
const GENERAL_ATTITUDE_AXIS = "friendship_hostility" as const;

/** `relationship` blocks du PERSONNAGE JOUÉ, indexés par cible — c'est SA perception qui compte pour `known_as`, jamais celle du PNJ. */
async function knownAsByTarget(supabase: TypedClient, playerEntityId: string): Promise<Map<string, string>> {
  const blocks = await listBlocksForEntity(supabase, playerEntityId);
  const map = new Map<string, string>();
  for (const block of blocks) {
    if (block.block_type !== "relationship") continue;
    const parsed = zRelationshipBlockData.safeParse(block.data);
    if (!parsed.success || parsed.data.target?.kind !== "entity" || parsed.data.knownAs.trim() === "") continue;
    map.set(parsed.data.target.id, parsed.data.knownAs);
  }
  return map;
}

async function resolvePresentNpcs(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; playerEntityId: string; present: { entityId: string; zone: TurnContextNpc["zone"] }[] }
): Promise<TurnContextNpc[]> {
  const others = params.present.filter((p) => p.entityId !== params.playerEntityId);
  if (others.length === 0) return [];

  const [entities, knownAs] = await Promise.all([
    listEntitiesByIds(supabase, others.map((p) => p.entityId)),
    knownAsByTarget(supabase, params.playerEntityId),
  ]);
  const nameById = new Map(entities.map((e) => [e.id, e.name]));

  const npcs: TurnContextNpc[] = [];
  for (const p of others) {
    const { axes } = await getCurrentAttitude(supabase, params.worldId, p.entityId, params.playerEntityId);
    const value = axes[GENERAL_ATTITUDE_AXIS];
    npcs.push({
      id: p.entityId,
      name: knownAs.get(p.entityId) ?? nameById.get(p.entityId) ?? p.entityId,
      attitudeLabel: value === undefined ? null : relationshipAxisLabel(GENERAL_ATTITUDE_AXIS, value),
      zone: p.zone,
    });
  }
  return npcs;
}

async function resolveQuests(supabase: TypedClient, worldId: string, viewer: Viewer): Promise<TurnContextQuest[]> {
  const quests = await listActiveQuestsForWorld(supabase, worldId, viewer);
  return quests.map((q) => ({
    title: q.label,
    openObjectives: q.data.objectives.filter((o) => !o.done).map((o) => o.text),
  }));
}

/** V3-B4 — Les textes des dernières narrations de CETTE session, plus récente en tête ; une ligne dont `payload.text` ne serait pas une chaîne (jamais écrit par ce code, mais un payload reste une donnée non typée en base) est ignorée plutôt que de casser tout le contexte pour ça. */
async function resolveRecentNarrations(supabase: TypedClient, sessionId: string): Promise<string[]> {
  const events = await listRecentEventsByKind(supabase, sessionId, "narration", RECENT_NARRATIONS_KEPT);
  return events
    .map((e) => (e.payload as { text?: unknown } | null)?.text)
    .filter((text): text is string => typeof text === "string");
}

export interface SoloTurnContext {
  /** Le texte pret a poser en message `user`. */
  text: string;
  /** Les ids des PNJ presents — jamais devine par l'appelant : c'est ce qui borne l'enum `npc_id` d'un outil de narration (meme garde-fou que le spike, generalise). */
  npcIds: string[];
  /** V3-B4 — Rendues telles quelles (pas seulement injectees dans `text`) pour que l'appelant (`narrateSoloTurn`) puisse mesurer la similarite d'un essai SANS relire la session une seconde fois. */
  recentNarrations: string[];
}

export async function buildSoloTurnContext(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    playerEntityId: string;
    /** Le viewer du JOUEUR qui joue ce tour — jamais un viewer `gm`, c'est lui qui borne l'audience. */
    viewer: Viewer;
    /** V3-B4 — sert à relire les dernières narrations de CETTE session, pour la consigne de ne pas les répéter. */
    sessionId: string;
    playerAction: string;
    facts: string[];
    changes: string[];
    hints: string[];
  }
): Promise<SoloTurnContext> {
  const scene = await getSceneState(supabase, params.campaignId);

  const [locationEntity, npcs, quests, recentNarrations] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, present: scene.present })
      : Promise.resolve([]),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentNarrations(supabase, params.sessionId),
  ]);

  const input: TurnContextInput = {
    locationName: locationEntity?.name ?? "Hors scène",
    time: scene?.time ?? { day: 1, hour: 8, minute: 0 },
    lighting: scene?.lighting ?? "bright",
    npcs,
    quests,
    facts: params.facts,
    changes: params.changes,
    hints: params.hints,
    playerAction: params.playerAction,
    recentNarrations,
  };

  return { text: buildTurnContext(input), npcIds: npcs.map((n) => n.id), recentNarrations };
}

/**
 * V3-D4 — Même résolution que `buildSoloTurnContext` (scène, PNJ présents,
 * quêtes, dernières narrations), mais pour une question posée HORS DU
 * TEMPS DE JEU (le bouton `MJ`) : pas de `playerAction`/`facts`/`changes`/
 * `hints`, rien n'a été résolu — voir `buildGmQuestionContext`
 * (`src/core/ai/`) pour ce qui distingue les deux compositions.
 */
export async function buildSoloGmQuestionContext(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    playerEntityId: string;
    /** Le viewer du JOUEUR qui pose la question — jamais un viewer `gm`. */
    viewer: Viewer;
    sessionId: string;
    question: string;
  }
): Promise<{ text: string }> {
  const scene = await getSceneState(supabase, params.campaignId);

  const [locationEntity, npcs, quests, recentNarrations] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, present: scene.present })
      : Promise.resolve([]),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentNarrations(supabase, params.sessionId),
  ]);

  return {
    text: buildGmQuestionContext({
      locationName: locationEntity?.name ?? "Hors scène",
      time: scene?.time ?? { day: 1, hour: 8, minute: 0 },
      lighting: scene?.lighting ?? "bright",
      npcs,
      quests,
      recentNarrations,
      question: params.question,
    }),
  };
}
