import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import {
  BLOCK_TYPES,
  type BlockType,
  dataSchemaForBlockType,
  defaultBlockData,
  defaultBlockDisplay,
} from "@/src/core/schemas/blocks/registry";
import {
  type BlockRow,
  deleteBlock as repoDeleteBlock,
  getBlockById,
  insertBlock,
  listBlocksForEntity,
  maxDisplayOrder,
  updateBlockDisplayOrder,
  updateBlockWithVersionCheck,
} from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { updateAssetVisibility } from "@/src/server/repos/assets";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { canUserEditEntityById } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

export interface VisibleBlock {
  id: string;
  entityId: string;
  blockType: string;
  display: BlockDisplay;
  data: Json;
  displayOrder: number;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

function toVisibleBlock(row: BlockRow): VisibleBlock {
  return {
    id: row.id,
    entityId: row.entity_id,
    blockType: row.block_type,
    display: row.display as unknown as BlockDisplay,
    data: row.data,
    displayOrder: row.display_order,
    version: row.version,
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
  };
}

function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as VisibilityLevel,
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Liste filtree par visibilite (docs/SCHEMA.md §4.2, §19.2) : la RLS ne
 * filtre que l'appartenance au monde, la visibilite fine (public/players/
 * gm/...) est resolue ici, cote service, avant l'envoi.
 */
export async function listVisibleBlocks(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  userId: string
): Promise<VisibleBlock[]> {
  const [rows, viewer] = await Promise.all([
    listBlocksForEntity(supabase, entityId),
    buildViewerForWorld(supabase, worldId, userId),
  ]);
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);
  return visible.map(toVisibleBlock);
}

function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/**
 * Un seul fond de wiki actif a la fois par fiche (V2-G13, retour
 * utilisateur) : applique cote serveur, pas seulement dans l'UI — cocher
 * "definir le fond du wiki" sur un bloc decoche silencieusement ce meme
 * champ sur tout autre bloc `image` de la meme entite, jamais une race qui
 * pourrait en laisser deux actifs entre deux onglets.
 */
async function clearOtherWikiBackgrounds(supabase: TypedClient, entityId: string, exceptBlockId: string): Promise<void> {
  const rows = await listBlocksForEntity(supabase, entityId);
  for (const row of rows) {
    if (row.id === exceptBlockId || row.block_type !== "image") continue;
    const data = row.data as { useAsWikiBackground?: boolean } | null;
    if (!data?.useAsWikiBackground) continue;
    await updateBlockWithVersionCheck(supabase, {
      id: row.id,
      expectedVersion: row.version,
      display: row.display,
      data: { ...data, useAsWikiBackground: false } as Json,
      visibilityLevel: row.visibility_level,
      visibilityScopeId: row.visibility_scope_id,
    });
  }
}

/**
 * Un bloc `map` mode "own" ecrit sa visibilite sur `blocks.visibility_level`,
 * mais l'image qu'il porte vit dans une ligne `assets` distincte, filtree
 * par sa PROPRE `visibility_level` a la lecture (RLS `assets_select`,
 * migration 20260804150001) — jamais celle du bloc. Sans ce rappel, changer
 * la visibilite du bloc apres coup (dropdown) laisse l'image lisible a son
 * ancien niveau (CLAUDE.md regle 4 : resolution cote serveur, avant l'envoi).
 * Ne s'applique qu'a `mode: "own"` — le mode "ref" ne porte pas d'asset,
 * seule sa fiche `carte` source en porte un.
 */
async function syncMapAssetVisibility(
  supabase: TypedClient,
  data: Json,
  visibilityLevel: string,
  visibilityScopeId: string | null
): Promise<void> {
  const mapData = data as unknown as MapBlockData;
  if (mapData.mode !== "own") return;
  for (const assetId of [mapData.assetId, mapData.thumbnailAssetId]) {
    if (assetId) await updateAssetVisibility(supabase, assetId, { visibilityLevel, visibilityScopeId });
  }
}

/** Edition redactionnelle d'un bloc = nouvelle revision de son entite (V1-C3, specs/wiki-blocs.md §4.5). `changeSource` distingue une proposition IA appliquee (V1-F3) d'une edition manuelle. */
async function recordBlockRevision(
  supabase: TypedClient,
  entityId: string,
  changedBy: string,
  changeSource: "user" | "ai" = "user"
): Promise<void> {
  const entity = await getEntityById(supabase, entityId);
  if (!entity) return;
  await recordEntityRevision(supabase, { entity, changeSource, changedBy });
}

export type CreateBlockResult = { ok: true; block: VisibleBlock } | { ok: false; reason: "forbidden" };

export async function createBlock(
  supabase: TypedClient,
  params: {
    entityId: string;
    blockType: string;
    label: string;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<CreateBlockResult> {
  if (!isBlockType(params.blockType)) {
    throw new Error(`Type de bloc inconnu : ${params.blockType}`);
  }

  // V2-M3 (Lot M) : ajouter un bloc a une entite est une ecriture sur
  // cette entite, meme garde que `updateEntity`.
  const allowed = await canUserEditEntityById(supabase, { entityId: params.entityId, userId: params.createdBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const display = defaultBlockDisplay(params.blockType, params.label);
  const data = defaultBlockData(params.blockType);
  const displayOrder = (await maxDisplayOrder(supabase, params.entityId)) + 1000;

  const row = await insertBlock(supabase, {
    entityId: params.entityId,
    blockType: params.blockType,
    display,
    data: data as Json,
    displayOrder,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  await recordBlockRevision(supabase, params.entityId, params.createdBy);
  return { ok: true, block: toVisibleBlock(row) };
}

export async function updateBlockContent(
  supabase: TypedClient,
  params: {
    id: string;
    expectedVersion: number;
    display: Json;
    data: unknown;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    changedBy: string;
    changeSource?: "user" | "ai";
  }
): Promise<{ ok: true; block: VisibleBlock } | { ok: false; reason: "conflict" | "not_found" | "forbidden" }> {
  const existing = await getBlockById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (!isBlockType(existing.block_type)) {
    throw new Error(`Type de bloc inconnu en base : ${existing.block_type}`);
  }

  // V2-M3 (Lot M) : verifie avant de valider/ecrire — un refus ne doit pas
  // dependre de la forme des donnees envoyees.
  const allowed = await canUserEditEntityById(supabase, { entityId: existing.entity_id, userId: params.changedBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const validatedData = dataSchemaForBlockType(existing.block_type).parse(params.data);

  const row = await updateBlockWithVersionCheck(supabase, {
    id: params.id,
    expectedVersion: params.expectedVersion,
    display: params.display,
    data: validatedData as Json,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
  });
  if (!row) return { ok: false, reason: "conflict" };
  await recordBlockRevision(supabase, existing.entity_id, params.changedBy, params.changeSource ?? "user");

  if (existing.block_type === "image" && (validatedData as { useAsWikiBackground?: boolean }).useAsWikiBackground) {
    await clearOtherWikiBackgrounds(supabase, existing.entity_id, params.id);
  }

  if (existing.block_type === "map") {
    await syncMapAssetVisibility(supabase, row.data, params.visibilityLevel, params.visibilityScopeId);
  }

  return { ok: true, block: toVisibleBlock(row) };
}

export async function reorderBlock(
  supabase: TypedClient,
  params: { id: string; expectedVersion: number; displayOrder: number; changedBy: string }
): Promise<{ ok: true; block: VisibleBlock } | { ok: false; reason: "conflict" | "not_found" | "forbidden" }> {
  const existing = await getBlockById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: existing.entity_id, userId: params.changedBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const row = await updateBlockDisplayOrder(supabase, params);
  if (!row) return { ok: false, reason: "conflict" };
  return { ok: true, block: toVisibleBlock(row) };
}

export async function deleteBlock(
  supabase: TypedClient,
  id: string,
  changedBy: string
): Promise<{ ok: true } | { ok: false; reason: "forbidden" }> {
  const existing = await getBlockById(supabase, id);
  if (!existing) return { ok: true }; // idempotent (voir l'appelant) : rien a faire n'est pas un refus
  const allowed = await canUserEditEntityById(supabase, { entityId: existing.entity_id, userId: changedBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  await repoDeleteBlock(supabase, id);
  await recordBlockRevision(supabase, existing.entity_id, changedBy);
  return { ok: true };
}
