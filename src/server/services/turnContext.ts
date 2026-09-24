import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { buildTurnContext, type TurnContextInput, type TurnContextNpc, type TurnContextQuest } from "@/src/core/ai/turnContext";
import { relationshipAxisLabel } from "@/src/core/psyche/bands";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";

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

export async function buildSoloTurnContext(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    playerEntityId: string;
    /** Le viewer du JOUEUR qui joue ce tour — jamais un viewer `gm`, c'est lui qui borne l'audience. */
    viewer: Viewer;
    playerAction: string;
    facts: string[];
    changes: string[];
    hints: string[];
  }
): Promise<string> {
  const scene = await getSceneState(supabase, params.campaignId);

  const [locationEntity, npcs, quests] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, present: scene.present })
      : Promise.resolve([]),
    resolveQuests(supabase, params.worldId, params.viewer),
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
  };

  return buildTurnContext(input);
}
