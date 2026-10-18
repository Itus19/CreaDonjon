import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, type Viewer, type VisibilityLevel } from "@/src/core/visibility";
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
  InsertBlockError,
  listBlocksForEntity,
  maxDisplayOrder,
  saveEntityBlocksBatch,
  updateBlockDisplayOrder,
  updateBlockWithVersionCheck,
} from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { composeCharacterName } from "@/src/core/rules/characterName";
import { getBlockImageAssetId } from "@/src/server/repos/blockImages";
import { updateAssetVisibility } from "@/src/server/repos/assets";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import { imagesAbandonnees } from "@/src/core/images/imagesDeCarte";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { canUserEditEntityById } from "@/src/server/services/permissions";
import { updateEntity } from "@/src/server/services/entities";
import { deleteAsset, deleteAssetIfUnreferenced } from "@/src/server/services/storage";

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

/** Exportee pour reutilisation par `generators.ts` (V2-J9bis) : le panneau MJ Generateurs a besoin de la forme complete d'un bloc (version/visibilite comprises) pour editer une table en place, pas seulement ses donnees. */
export function toVisibleBlock(row: BlockRow): VisibleBlock {
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

/** Le même filtre que `listVisibleBlocks`, sur des lignes déjà lues par lot (V3.1-82 : plusieurs fiches en une requête). */
export function filtrerBlocsVisibles<R extends BlockRow>(rows: readonly R[], viewer: Viewer): R[] {
  return filterBlocks(rows.map((row) => ({ ...toVisibilityAware(row), row })), viewer).map((aware) => aware.row);
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

export type CreateBlockResult =
  | { ok: true; block: VisibleBlock }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "duplicate_block_type" };

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

  let row: BlockRow;
  try {
    row = await insertBlock(supabase, {
      entityId: params.entityId,
      blockType: params.blockType,
      display,
      data: data as Json,
      displayOrder,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
    });
  } catch (error) {
    // V2.1-5 : au plus un bloc personality/worldview par fiche (index unique
    // blocks_personality_worldview_uniq, migration 20260904220000) — une
    // violation de cette contrainte precise est un refus attendu, jamais
    // une erreur 500 opaque.
    if (error instanceof InsertBlockError && error.code === "23505") {
      return { ok: false, reason: "duplicate_block_type" };
    }
    throw error;
  }
  await recordBlockRevision(supabase, params.entityId, params.createdBy);
  return { ok: true, block: toVisibleBlock(row) };
}

/**
 * Recompose le nom de l'entite « Prenom Nom » quand le prenom ou le nom du
 * bloc `character` ont change (V3.1-48). Passe par `updateEntity` (droit
 * d'ecriture, version, revision). Les mentions du wiki pointent l'entite par
 * `id` : elles suivent ; le `label` qu'un auteur a ecrit n'est jamais
 * reecrit (specs/wiki-liens-et-personnages.md §A1). Un echec de renommage
 * n'annule pas l'enregistrement du bloc, mais il est journalise.
 */
async function renameEntityAfterNameChange(
  supabase: TypedClient,
  params: { entityId: string; before: unknown; after: unknown; changedBy: string }
): Promise<void> {
  const names = (data: unknown) => {
    const d = (data ?? {}) as { given_name?: unknown; family_name?: unknown };
    return {
      given: typeof d.given_name === "string" ? d.given_name : undefined,
      family: typeof d.family_name === "string" ? d.family_name : undefined,
    };
  };
  const before = names(params.before);
  const after = names(params.after);
  if (before.given === after.given && before.family === after.family) return;
  const composed = composeCharacterName(after.given, after.family);
  if (!composed) return;
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity || entity.name === composed) return;
  const renamed = await updateEntity(supabase, {
    id: entity.id,
    changedBy: params.changedBy,
    expectedVersion: entity.version,
    name: composed,
    entityKind: entity.entity_kind,
    aliases: entity.aliases,
    isPublic: entity.is_public,
  });
  if (!renamed.ok) console.error("Renommage de l'entite apres changement de prenom/nom impossible", params.entityId, renamed.reason);
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

  // Ici l'inconnu est une FAUTE, pas un cas a tolerer : on edite un bloc
  // precis, et ne pas savoir le valider doit refuser l'ecriture plutot que
  // la laisser passer. Message explicite au lieu du `TypeError` opaque que
  // produisait l'appel direct a `.parse` sur un schema absent.
  const schema = dataSchemaForBlockType(existing.block_type);
  if (!schema) throw new Error(`Type de bloc inconnu : "${existing.block_type}".`);
  const validatedData = schema.parse(params.data);

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
  await apresEcritureBloc(supabase, { existing, row, validatedData, changedBy: params.changedBy });

  return { ok: true, block: toVisibleBlock(row) };
}

/**
 * Ce qu'une ecriture de contenu entraine pour UN bloc, une fois la ligne
 * ecrite : commun a l'ecriture d'un bloc seul (`updateBlockContent`) et a
 * l'enregistrement groupe de l'editeur plein ecran (`saveEntityBlocks`).
 */
async function apresEcritureBloc(
  supabase: TypedClient,
  params: { existing: BlockRow; row: BlockRow; validatedData: unknown; changedBy: string }
): Promise<void> {
  const { existing, row, validatedData } = params;
  if (existing.block_type === "image" && (validatedData as { useAsWikiBackground?: boolean }).useAsWikiBackground) {
    await clearOtherWikiBackgrounds(supabase, existing.entity_id, row.id);
  }

  if (existing.block_type === "character") {
    await renameEntityAfterNameChange(supabase, {
      entityId: existing.entity_id,
      before: existing.data,
      after: validatedData,
      changedBy: params.changedBy,
    });
  }

  if (existing.block_type === "map") {
    await syncMapAssetVisibility(supabase, row.data, row.visibility_level, row.visibility_scope_id);
    // V3.1-128 : une image remplacee ne reste pas dans le stockage.
    for (const assetId of imagesAbandonnees(existing.data, row.data)) {
      await deleteAssetIfUnreferenced(supabase, assetId);
    }
  }
}

export interface BlockChangeInput {
  id: string;
  version: number;
  display: Json;
  data: unknown;
  visibilityLevel: string;
  visibilityScopeId: string | null;
  displayOrder: number;
}

export type SaveEntityBlocksResult =
  | { ok: true; blocks: VisibleBlock[] }
  | { ok: false; reason: "conflict" | "not_found" | "forbidden" };

/**
 * V3.1-31 — l'enregistrement de l'editeur plein ecran : plusieurs blocs d'une
 * fiche, contenu et ordre, en UNE ecriture. Tout ou rien (`save_entity_blocks`,
 * une transaction) : une version perimee annule l'ensemble.
 *
 * Memes barrieres que `updateBlockContent`, dans le meme ordre : le droit
 * d'ecrire avant toute validation (un refus ne depend pas de la forme des
 * donnees), puis chaque bloc doit appartenir a CETTE fiche, puis chaque
 * `data` est validee par le schema de son type (`ZodError` remonte : 400).
 * Une seule revision de l'entite pour tout l'enregistrement.
 */
export async function saveEntityBlocks(
  supabase: TypedClient,
  params: { entityId: string; changes: BlockChangeInput[]; changedBy: string }
): Promise<SaveEntityBlocksResult> {
  const allowed = await canUserEditEntityById(supabase, { entityId: params.entityId, userId: params.changedBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  // Lus sous la RLS du lecteur : un bloc qu'il ne voit pas est « introuvable ».
  const existants = new Map((await listBlocksForEntity(supabase, params.entityId)).map((b) => [b.id, b]));
  const valides: { existing: BlockRow; change: BlockChangeInput; validatedData: unknown }[] = [];
  for (const change of params.changes) {
    const existing = existants.get(change.id);
    if (!existing) return { ok: false, reason: "not_found" };
    if (!isBlockType(existing.block_type)) throw new Error(`Type de bloc inconnu en base : ${existing.block_type}`);
    const schema = dataSchemaForBlockType(existing.block_type);
    if (!schema) throw new Error(`Type de bloc inconnu : "${existing.block_type}".`);
    valides.push({ existing, change, validatedData: schema.parse(change.data) });
  }

  const rows = await saveEntityBlocksBatch(
    supabase,
    params.entityId,
    valides.map(({ change, validatedData }) => ({
      id: change.id,
      version: change.version,
      display: change.display,
      data: validatedData as Json,
      visibilityLevel: change.visibilityLevel,
      visibilityScopeId: change.visibilityScopeId,
      displayOrder: change.displayOrder,
    }))
  );
  if (!rows) return { ok: false, reason: "conflict" };

  await recordBlockRevision(supabase, params.entityId, params.changedBy, "user");
  const parId = new Map(rows.map((r) => [r.id, r]));
  for (const { existing, validatedData } of valides) {
    const row = parId.get(existing.id);
    if (row) await apresEcritureBloc(supabase, { existing, row, validatedData, changedBy: params.changedBy });
  }
  return { ok: true, blocks: rows.map(toVisibleBlock) };
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

  // Bloc `image` (V2-L1) : `block_images` est cascade-supprimee avec le
  // bloc (FK `on delete cascade`), mais son `asset_id` ne l'est jamais —
  // l'asset (Storage) doit etre retire explicitement ici, sous peine d'un
  // orphelin permanent dans le bucket a chaque suppression de bloc image.
  const assetId = existing.block_type === "image" ? await getBlockImageAssetId(supabase, id) : null;

  await repoDeleteBlock(supabase, id);
  if (assetId) await deleteAsset(supabase, assetId);
  // V3.1-128 : un bloc `map` porte ses images dans ses donnees ; elles ne
  // partent que si aucun autre bloc (fiche ou bloc duplique) ne les designe.
  if (existing.block_type === "map") {
    for (const mapAssetId of imagesAbandonnees(existing.data, null)) {
      await deleteAssetIfUnreferenced(supabase, mapAssetId);
    }
  }
  await recordBlockRevision(supabase, existing.entity_id, changedBy);
  return { ok: true };
}
