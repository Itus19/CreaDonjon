import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canSee, filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import { computeSortKey } from "@/src/core/calendar/sortKey";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { zTimelineBlockData, type TimelineEntry, type TimelineScope } from "@/src/core/schemas/blocks/timeline";
import { lifeEventEntries, resolveScope, WORLD_TIMELINE_ENTITY_NAME, WORLD_TIMELINE_KIND } from "@/src/core/timeline/worldTimeline";
import { lifeDatesFromCharacter } from "@/src/core/genealogy/lifeDates";
import { getBlockById, listBlocksByTypeForEntities, listBlocksByTypesForEntities, type BlockRow } from "@/src/server/repos/blocks";
import { getEntityById, listEntitiesByKinds, listEntitiesForWorld, type EntitySummary } from "@/src/server/repos/entities";
import { createBlock, updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";
import { createEntity } from "@/src/server/services/entities";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { promoteToEntity } from "@/src/server/services/promotion";
import { getCalendar } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/** D'où vient une entrée de la frise générale (V3.1-96) : « Depuis la fiche de… ». */
export type WorldTimelineSource =
  | { kind: "world" }
  | { kind: "entity"; blockId: string }
  | { kind: "birth" | "death" };

export interface WorldTimelineEntry {
  entry: TimelineEntry;
  /** V3.1-96 : portée résolue (choisie, sinon défaut du genre). */
  scope: TimelineScope;
  source: WorldTimelineSource;
  sortKey: number;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceEntitySlug: string;
  /** Slug de l'entite pointee par `entry.ref` (kind "entity"), resolu ici : `entry.ref` ne porte qu'un id, jamais un slug (specs/wiki-blocs.md §3). */
  refEntitySlug: string | null;
}

/**
 * Vue generale du monde (V2-H2 phase 2, V3.1-96, ADR 0048) : les entrees des
 * blocs `timeline` du monde (dont la fiche systeme « Chronologie du monde »)
 * et les naissances et morts des blocs `character`, lus en UNE requete,
 * triees par `sort_key`. Chaque date est filtree POUR CE LECTEUR avant
 * l'envoi (regle 5) : la visibilite du bloc d'abord, puis celle de l'entree.
 * Les seances n'y entrent pas.
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
  const rows = await listBlocksByTypesForEntities(
    supabase,
    entities.map((e) => e.id),
    ["timeline", "character"]
  );
  const blocks = filterBlocks(
    rows.map((r) => ({ ...r, visibility: { level: r.visibility_level as VisibilityLevel, scopeId: r.visibility_scope_id, createdBy: r.created_by } })),
    viewer
  );

  const result: WorldTimelineEntry[] = [];
  const push = (entry: TimelineEntry, source: WorldTimelineSource, sourceEntity: EntitySummary) => {
    result.push({
      entry,
      scope: resolveScope(entry),
      source,
      sortKey: computeSortKey(entry.date, calendar),
      sourceEntityId: sourceEntity.id,
      sourceEntityName: sourceEntity.name,
      sourceEntitySlug: sourceEntity.slug,
      refEntitySlug: entry.ref?.kind === "entity" ? (entityById.get(entry.ref.id)?.slug ?? null) : null,
    });
  };

  for (const block of blocks) {
    const sourceEntity = entityById.get(block.entity_id);
    if (!sourceEntity) continue;
    if (block.block_type === "character") {
      const dates = lifeDatesFromCharacter(block.data);
      const visibility = { level: block.visibility_level as TimelineEntry["visibility"]["level"], scopeId: block.visibility_scope_id };
      for (const entry of lifeEventEntries({ entityId: sourceEntity.id, name: sourceEntity.name, ...dates, visibility })) {
        push(entry, { kind: entry.kind === "birth" ? "birth" : "death" }, sourceEntity);
      }
      continue;
    }
    const parsed = zTimelineBlockData.safeParse(block.data);
    if (!parsed.success) {
      console.error("Bloc timeline mal forme, ignore dans la frise", block.id, parsed.error.issues);
      continue;
    }
    const source: WorldTimelineSource = sourceEntity.entity_kind === WORLD_TIMELINE_KIND ? { kind: "world" } : { kind: "entity", blockId: block.id };
    for (const entry of parsed.data.entries) {
      if (!canSee({ level: entry.visibility.level, scopeId: entry.visibility.scopeId, createdBy: null }, viewer)) continue;
      push(entry, source, sourceEntity);
    }
  }
  result.sort((a, b) => a.sortKey - b.sortKey);
  return { entries: result, calendar };
}

/** Ce qu'on écrit quand on ajoute un événement (V3.1-96) ; l'identifiant est posé par le serveur. */
export type NewTimelineEvent = Omit<TimelineEntry, "id" | "ref">;

export type TimelineWriteResult = { ok: true; block: VisibleBlock } | { ok: false; reason: "forbidden" | "not_found" | "conflict" };

/**
 * La fiche système « Chronologie du monde » (V3.1-96, ADR 0048) et son bloc
 * Chronologie, créés au premier événement. Réservée au MJ (la RLS le redit,
 * migration 20261013160000). Une création concurrente tombe sur l'index
 * unique : on relit alors celle qui a gagné.
 */
async function ensureWorldTimelineBlock(supabase: TypedClient, worldId: string, userId: string): Promise<BlockRow | null> {
  const find = async () => (await listEntitiesByKinds(supabase, worldId, [WORLD_TIMELINE_KIND]))[0] ?? null;
  let entity = await find();
  if (!entity) {
    try {
      entity = await createEntity(supabase, { worldId, createdBy: userId, name: WORLD_TIMELINE_ENTITY_NAME, entityKind: WORLD_TIMELINE_KIND, aliases: [] });
    } catch (err) {
      entity = await find();
      if (!entity) throw err;
    }
  }
  return timelineBlockOf(supabase, entity.id, userId);
}

/** Le bloc Chronologie d'une fiche, créé s'il n'y en a pas. `null` : écriture refusée. */
async function timelineBlockOf(supabase: TypedClient, entityId: string, userId: string): Promise<BlockRow | null> {
  const [existing] = await listBlocksByTypeForEntities(supabase, [entityId], "timeline");
  if (existing) return existing;
  const created = await createBlock(supabase, { entityId, blockType: "timeline", label: "Chronologie", visibilityLevel: "public", visibilityScopeId: null, createdBy: userId });
  if (!created.ok) return null;
  return getBlockById(supabase, created.block.id);
}

/**
 * Ajoute un événement (V3.1-96) : dans la frise générale (fiche système,
 * MJ seulement) ou dans le bloc Chronologie d'une fiche (droit d'écriture
 * sur la fiche, `updateBlockContent` le vérifie).
 */
export async function addTimelineEvent(
  supabase: TypedClient,
  params: { worldId: string; userId: string; target: { kind: "world" } | { kind: "entity"; entityId: string }; event: NewTimelineEvent }
): Promise<TimelineWriteResult> {
  let block: BlockRow | null;
  if (params.target.kind === "world") {
    if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }))) return { ok: false, reason: "forbidden" };
    block = await ensureWorldTimelineBlock(supabase, params.worldId, params.userId);
  } else {
    const entity = await getEntityById(supabase, params.target.entityId);
    if (!entity || entity.world_id !== params.worldId) return { ok: false, reason: "not_found" };
    block = await timelineBlockOf(supabase, entity.id, params.userId);
  }
  if (!block) return { ok: false, reason: "forbidden" };
  const parsed = zTimelineBlockData.safeParse(block.data);
  if (!parsed.success) return { ok: false, reason: "not_found" };
  const entry: TimelineEntry = { ...params.event, id: crypto.randomUUID() };
  return updateBlockContent(supabase, {
    id: block.id,
    expectedVersion: block.version,
    display: block.display,
    data: { ...parsed.data, entries: [...parsed.data.entries, entry] },
    visibilityLevel: block.visibility_level,
    visibilityScopeId: block.visibility_scope_id,
    changedBy: params.userId,
  });
}

/** Change la portée d'une entrée (V3.1-96) ; `null` la rend au défaut de son genre. Droit d'écriture vérifié par `updateBlockContent`. */
export async function setTimelineEntryScope(
  supabase: TypedClient,
  params: { blockId: string; entryId: string; scope: TimelineScope | null; expectedVersion: number; userId: string }
): Promise<TimelineWriteResult> {
  const row = await getBlockById(supabase, params.blockId);
  if (!row || row.block_type !== "timeline") return { ok: false, reason: "not_found" };
  const parsed = zTimelineBlockData.safeParse(row.data);
  if (!parsed.success || !parsed.data.entries.some((e) => e.id === params.entryId)) return { ok: false, reason: "not_found" };
  // `undefined` disparaît à l'écriture JSON : la portée revient au défaut du genre.
  const entries = parsed.data.entries.map((e) => (e.id === params.entryId ? { ...e, scope: params.scope ?? undefined } : e));
  return updateBlockContent(supabase, {
    id: row.id,
    expectedVersion: params.expectedVersion,
    display: row.display,
    data: { ...parsed.data, entries },
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
    changedBy: params.userId,
  });
}

export type PromoteTimelineEntryResult =
  | { ok: true; entity: EntitySummary; block: VisibleBlock }
  | { ok: false; reason: "conflict" | "not_found" | "already_promoted" | "forbidden" };

/**
 * Promotion d'une entree en entite (specs/wiki-blocs.md §3, §7) — appelle
 * desormais le mecanisme generique `promoteToEntity`
 * (src/server/services/promotion.ts, V1-E6/V2-J2), reutilise aussi par la
 * promotion d'un resultat de generateur : plus un one-off, un seul
 * mecanisme partage. La date et le titre RESTENT sur l'entree — c'est ce
 * qui la place dans cette timeline-ci — une reference les relie. Rien
 * n'est perdu, rien n'est duplique en stockage.
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

  const promoted = await promoteToEntity(supabase, {
    worldId: hostEntity.world_id,
    createdBy: params.createdBy,
    name: entry.title,
    entityKind: "event",
    visibilityLevel: entry.visibility.level,
    visibilityScopeId: entry.visibility.scopeId,
    blocks: [{ label: "Description", text: entry.summary }],
  });
  if (!promoted.ok) return { ok: false, reason: "forbidden" };
  const newEntity = promoted.entity;

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
