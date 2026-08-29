import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canSee } from "@/src/core/visibility";
import { computeSortKey } from "@/src/core/calendar/sortKey";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { zTimelineBlockData, type TimelineEntry } from "@/src/core/schemas/blocks/timeline";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { getBlockById, listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEntityById, listEntitiesForWorld, type EntitySummary } from "@/src/server/repos/entities";
import { createBlock, updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";
import { createEntity } from "@/src/server/services/entities";
import { getCalendar } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

export interface WorldTimelineEntry {
  entry: TimelineEntry;
  sortKey: number;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceEntitySlug: string;
  /** Slug de l'entite pointee par `entry.ref` (kind "entity"), resolu ici : `entry.ref` ne porte qu'un id, jamais un slug (specs/wiki-blocs.md §3). */
  refEntitySlug: string | null;
}

/**
 * Vue generale du monde (V2-H2 phase 2) : agrege les entrees visibles de
 * TOUS les blocs `timeline` du monde, triees par `sort_key` — chaque entree
 * porte deja sa date complete (specs/wiki-blocs.md §3, simplification actee
 * avec le client dans `src/core/schemas/blocks/timeline.ts` : pas de
 * requete separee par entite, l'agregation lit directement les blocs).
 */
export async function getWorldTimeline(
  supabase: TypedClient,
  worldId: string,
  userId: string
): Promise<{ entries: WorldTimelineEntry[]; calendar: CalendarConfigInput }> {
  const [entities, calendar, viewer] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    getCalendar(supabase, worldId),
    buildViewerForWorld(supabase, worldId, userId),
  ]);
  const entityById = new Map<string, EntitySummary>(entities.map((e) => [e.id, e]));
  const blocks = await listBlocksByTypeForEntities(
    supabase,
    entities.map((e) => e.id),
    "timeline"
  );

  const result: WorldTimelineEntry[] = [];
  for (const block of blocks) {
    const parsed = zTimelineBlockData.safeParse(block.data);
    if (!parsed.success) continue;
    const sourceEntity = entityById.get(block.entity_id);
    if (!sourceEntity) continue;
    for (const entry of parsed.data.entries) {
      const visible = canSee(
        { level: entry.visibility.level, scopeId: entry.visibility.scopeId, createdBy: null },
        viewer
      );
      if (!visible) continue;
      const refEntitySlug =
        entry.ref?.kind === "entity" ? (entityById.get(entry.ref.id)?.slug ?? null) : null;
      result.push({
        entry,
        sortKey: computeSortKey(entry.date, calendar),
        sourceEntityId: sourceEntity.id,
        sourceEntityName: sourceEntity.name,
        sourceEntitySlug: sourceEntity.slug,
        refEntitySlug,
      });
    }
  }
  result.sort((a, b) => a.sortKey - b.sortKey);
  return { entries: result, calendar };
}

export type PromoteTimelineEntryResult =
  | { ok: true; entity: EntitySummary; block: VisibleBlock }
  | { ok: false; reason: "conflict" | "not_found" | "already_promoted" };

/**
 * Promotion d'une entree en entite (specs/wiki-blocs.md §3, §7 — motif
 * generique, un seul consommateur concret pour l'instant). Le resume part
 * dans la nouvelle fiche (bloc `text`) ; la date et le titre RESTENT sur
 * l'entree — c'est ce qui la place dans cette timeline-ci — une reference
 * les relie. Rien n'est perdu, rien n'est duplique en stockage.
 */
export async function promoteTimelineEntry(
  supabase: TypedClient,
  params: { blockId: string; entryId: string; expectedVersion: number; createdBy: string }
): Promise<PromoteTimelineEntryResult> {
  const row = await getBlockById(supabase, params.blockId);
  if (!row || row.block_type !== "timeline") return { ok: false, reason: "not_found" };

  const parsed = zTimelineBlockData.safeParse(row.data);
  if (!parsed.success) return { ok: false, reason: "not_found" };
  const entry = parsed.data.entries.find((e) => e.id === params.entryId);
  if (!entry) return { ok: false, reason: "not_found" };
  if (entry.ref) return { ok: false, reason: "already_promoted" };

  const hostEntity = await getEntityById(supabase, row.entity_id);
  if (!hostEntity) return { ok: false, reason: "not_found" };

  const newEntity = await createEntity(supabase, {
    worldId: hostEntity.world_id,
    createdBy: params.createdBy,
    name: entry.title,
    entityKind: "event",
    aliases: [],
  });

  if (entry.summary.trim() !== "") {
    const textBlock = await createBlock(supabase, {
      entityId: newEntity.id,
      blockType: "text",
      label: "Description",
      visibilityLevel: entry.visibility.level,
      visibilityScopeId: entry.visibility.scopeId,
      createdBy: params.createdBy,
    });
    const seeded = zTextBlockData.parse({
      __v: 1,
      segments: [
        {
          id: crypto.randomUUID(),
          blockType: "paragraph",
          visibility: { level: "public", scopeId: null },
          content: [{ t: "text", v: entry.summary }],
          align: "left",
        },
      ],
    });
    await updateBlockContent(supabase, {
      id: textBlock.id,
      expectedVersion: textBlock.version,
      display: textBlock.display,
      data: seeded,
      visibilityLevel: textBlock.visibilityLevel,
      visibilityScopeId: textBlock.visibilityScopeId,
      changedBy: params.createdBy,
    });
  }

  const updatedEntries = parsed.data.entries.map((e) =>
    e.id === params.entryId ? { ...e, summary: "", ref: { kind: "entity" as const, id: newEntity.id } } : e
  );
  const result = await updateBlockContent(supabase, {
    id: params.blockId,
    expectedVersion: params.expectedVersion,
    display: row.display,
    data: { ...parsed.data, entries: updatedEntries },
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
    changedBy: params.createdBy,
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, entity: newEntity, block: result.block };
}
