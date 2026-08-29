import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { zQuestBlockData, type QuestBlockData } from "@/src/core/schemas/blocks/quest";
import { getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";
import { getEntityById, listEntitiesForWorld } from "@/src/server/repos/entities";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";
import { filterBlocks, type VisibilityLevel, type Viewer } from "@/src/core/visibility";

type TypedClient = SupabaseClient<Database>;

export type ToggleQuestObjectiveResult =
  | { ok: true; block: VisibleBlock }
  | { ok: false; reason: "not_found" | "not_a_quest" | "objective_not_found" | "conflict" };

/**
 * Cocher/decocher un objectif de quete (V2-H4) : un fait de partie, pas une
 * simple edition redactionnelle — ecrit la donnee du bloc ET journalise un
 * `session_event` (kind `world_update`, meme convention que
 * `runtimeState.ts`) si une session de campagne est ouverte pour le monde.
 * Sans campagne (monde hors partie), la case se coche quand meme : seul le
 * journal est absent, comme pour l'etat de jeu hors campagne.
 */
export async function toggleQuestObjective(
  supabase: TypedClient,
  params: {
    blockId: string;
    expectedVersion: number;
    objectiveId: string;
    done: boolean;
    actorUserId: string;
  }
): Promise<ToggleQuestObjectiveResult> {
  const existing = await getBlockById(supabase, params.blockId);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.block_type !== "quest") return { ok: false, reason: "not_a_quest" };

  const data = zQuestBlockData.parse(existing.data);
  const objective = data.objectives.find((o) => o.id === params.objectiveId);
  if (!objective) return { ok: false, reason: "objective_not_found" };

  const nextData: QuestBlockData = {
    ...data,
    objectives: data.objectives.map((o) => (o.id === params.objectiveId ? { ...o, done: params.done } : o)),
  };

  const result = await updateBlockContent(supabase, {
    id: params.blockId,
    expectedVersion: params.expectedVersion,
    display: existing.display,
    data: nextData,
    visibilityLevel: existing.visibility_level,
    visibilityScopeId: existing.visibility_scope_id,
    changedBy: params.actorUserId,
  });
  if (!result.ok) return { ok: false, reason: result.reason === "not_found" ? "not_found" : "conflict" };

  const entity = await getEntityById(supabase, existing.entity_id);
  const campaignId = entity ? await resolveCampaignId(supabase, entity.world_id) : null;
  if (campaignId) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
    const seq = await nextEventSeq(supabase, sessionId);
    await insertSessionEvent(supabase, {
      sessionId,
      seq,
      kind: "world_update",
      actor: "gm",
      actorUserId: params.actorUserId,
      payload: {
        entity_id: existing.entity_id,
        patch: { blockId: params.blockId, objectiveId: params.objectiveId, done: params.done },
        note: `${params.done ? "Objectif coché" : "Objectif décoché"} : ${objective.text}`,
      } as unknown as Json,
    });
  }

  return { ok: true, block: result.block };
}

export interface ActiveQuestSummary {
  entityId: string;
  entityName: string;
  entitySlug: string;
  blockId: string;
  label: string;
  data: QuestBlockData;
}

/**
 * Quetes en etat "en cours", filtrees par visibilite (regle 9 de CLAUDE.md :
 * le contexte fourni a un modele est borne par l'audience de sa sortie) —
 * expose ici pour que le contexte deterministe de la V3 (mode solo) puisse
 * s'y brancher sans nouvelle requete a ecrire alors. Rien ne l'appelle
 * encore hors des tests : la V3 n'existe pas.
 */
export async function listActiveQuestsForWorld(
  supabase: TypedClient,
  worldId: string,
  viewer: Viewer
): Promise<ActiveQuestSummary[]> {
  const entities = await listEntitiesForWorld(supabase, worldId);
  const results: ActiveQuestSummary[] = [];
  for (const entity of entities) {
    const rows = await listBlocksForEntity(supabase, entity.id);
    const questRows = rows.filter((r) => r.block_type === "quest");
    if (questRows.length === 0) continue;
    const visible = filterBlocks(
      questRows.map((r) => ({
        ...r,
        visibility: {
          level: r.visibility_level as VisibilityLevel,
          scopeId: r.visibility_scope_id,
          createdBy: r.created_by,
        },
      })),
      viewer
    );
    for (const row of visible) {
      const data = zQuestBlockData.parse(row.data);
      if (data.state !== "in_progress") continue;
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        entitySlug: entity.slug,
        blockId: row.id,
        label: (row.display as { label: string }).label,
        data,
      });
    }
  }
  return results;
}
