import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { diffEntitySnapshots } from "@/src/core/history/diff";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import type { EntitySnapshot, EntitySnapshotBlock, EntitySnapshotDiff } from "@/src/core/history/types";
import type { BlockRow } from "@/src/server/repos/blocks";
import { type EntitySummary, getEntityById } from "@/src/server/repos/entities";
import {
  fetchAllBlocksForEntity,
  getEntityRevisionByNumber,
  insertEntityRevision,
  listEntityRevisionSummaries,
  nextRevisionNumber,
  type RevisionSummaryRow,
} from "@/src/server/repos/entityRevisions";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

function toSnapshotBlock(row: BlockRow): EntitySnapshotBlock {
  return {
    id: row.id,
    blockType: row.block_type,
    display: row.display,
    data: row.data,
    displayOrder: row.display_order,
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
    createdBy: row.created_by,
  };
}

async function buildEntitySnapshot(supabase: TypedClient, entity: EntitySummary): Promise<EntitySnapshot> {
  const blocks = await fetchAllBlocksForEntity(supabase, entity.id);
  return {
    entity: { name: entity.name, entityKind: entity.entity_kind, aliases: entity.aliases },
    blocks: blocks.map(toSnapshotBlock),
  };
}

/** Forme brute des revisions ecrites avant ce ticket (V0-04) : l'entite a plat, jamais de blocs. */
interface LegacyStoredSnapshot {
  name: string;
  entity_kind: string;
  aliases: string[];
}

function isLegacySnapshot(raw: unknown): raw is LegacyStoredSnapshot {
  return typeof raw === "object" && raw !== null && !("entity" in raw);
}

/**
 * Les revisions plus anciennes que ce ticket ont ete stockees a plat
 * (`{name, entity_kind, aliases}`, jamais de `blocks`) — cf. l'ancien
 * `snapshotOf()` de src/server/services/entities.ts, ecrit avant que les
 * blocs n'existent. Comparer/afficher une revision de cette epoque ne doit
 * pas planter : `blocks` y est simplement absent, traite comme "aucun bloc
 * connu" (pas une supposition sur ce qu'il y avait reellement).
 */
function normalizeStoredSnapshot(raw: unknown): EntitySnapshot {
  if (isLegacySnapshot(raw)) {
    return { entity: { name: raw.name, entityKind: raw.entity_kind, aliases: raw.aliases }, blocks: [] };
  }
  const snapshot = raw as EntitySnapshot;
  return { entity: snapshot.entity, blocks: snapshot.blocks ?? [] };
}

/**
 * Distinct de `normalizeStoredSnapshot` : `restoreRevision` a besoin de
 * savoir si CETTE revision precise a vraiment capture ses blocs (auquel cas
 * en restaurer zero est un fait) ou si elle date d'avant ce ticket (auquel
 * cas "zero" serait une invention — ne pas toucher aux blocs actuels plutot
 * que les effacer sur la foi d'une absence de donnee historique).
 */
function hadCapturedBlocks(raw: unknown): boolean {
  return !isLegacySnapshot(raw);
}

/**
 * Point d'entree unique pour enregistrer une revision (V1-C3) : appele
 * apres toute mutation redactionnelle (entite ou bloc). Ne fait rien de
 * plus qu'un instantane + insertion — la concurrence (deux edits sur la
 * meme entite a quelques millisecondes d'intervalle) partage le meme
 * profil de risque que le reste de l'app (versions optimistes sur
 * entities/blocks), pas un nouveau risque introduit ici.
 */
export async function recordEntityRevision(
  supabase: TypedClient,
  params: {
    entity: EntitySummary;
    changeSource: "user" | "ai" | "import" | "system";
    changedBy: string;
    changeNote?: string;
  }
): Promise<void> {
  const snapshot = await buildEntitySnapshot(supabase, params.entity);
  const revisionNumber = await nextRevisionNumber(supabase, params.entity.id);
  await insertEntityRevision(supabase, {
    entityId: params.entity.id,
    revisionNumber,
    snapshot: snapshot as unknown as Json,
    changeSource: params.changeSource,
    changeNote: params.changeNote,
    changedBy: params.changedBy,
  });
}

export async function listRevisions(supabase: TypedClient, entityId: string): Promise<RevisionSummaryRow[]> {
  return listEntityRevisionSummaries(supabase, entityId);
}

function toVisibilityAware(block: EntitySnapshotBlock) {
  return {
    ...block,
    visibility: {
      level: block.visibilityLevel as VisibilityLevel,
      scopeId: block.visibilityScopeId,
      createdBy: block.createdBy,
    },
  };
}

async function loadFilteredSnapshot(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  revisionNumber: number,
  userId: string
): Promise<EntitySnapshot | null> {
  const revision = await getEntityRevisionByNumber(supabase, entityId, revisionNumber);
  if (!revision) return null;
  const snapshot = normalizeStoredSnapshot(revision.snapshot);
  const viewer = await buildViewerForWorld(supabase, worldId, userId);
  const visibleBlocks = filterBlocks(snapshot.blocks.map(toVisibilityAware), viewer);
  return { entity: snapshot.entity, blocks: visibleBlocks };
}

export interface RevisionDetail {
  revisionNumber: number;
  createdAt: string;
  changeSource: RevisionSummaryRow["change_source"];
  changeNote: string | null;
  snapshot: EntitySnapshot;
}

/** Contenu d'une revision, filtre par la visibilite du demandeur avant tout envoi (CLAUDE.md regle 4). */
export async function getRevisionForViewer(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  revisionNumber: number,
  userId: string
): Promise<RevisionDetail | null> {
  const revision = await getEntityRevisionByNumber(supabase, entityId, revisionNumber);
  if (!revision) return null;
  const filtered = await loadFilteredSnapshot(supabase, worldId, entityId, revisionNumber, userId);
  if (!filtered) return null;
  return {
    revisionNumber: revision.revision_number,
    createdAt: revision.created_at,
    changeSource: revision.change_source,
    changeNote: revision.change_note,
    snapshot: filtered,
  };
}

/**
 * Diff entre deux revisions : chaque instantane est filtre par la
 * visibilite du demandeur AVANT le calcul du diff, pas apres — un joueur ne
 * doit meme pas apprendre qu'un bloc MJ a ete "ajoute" ou "modifie", pas
 * seulement en ignorer le contenu.
 */
export async function compareRevisionsForViewer(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  fromNumber: number,
  toNumber: number,
  userId: string
): Promise<EntitySnapshotDiff | null> {
  const [from, to] = await Promise.all([
    loadFilteredSnapshot(supabase, worldId, entityId, fromNumber, userId),
    loadFilteredSnapshot(supabase, worldId, entityId, toNumber, userId),
  ]);
  if (!from || !to) return null;
  return diffEntitySnapshots(from, to);
}

export type RestoreRevisionResult =
  | { ok: true; entity: EntitySummary }
  | { ok: false; reason: "not_found" };

/**
 * Restaure une revision : jamais une reecriture de l'historique (esprit
 * "ajout seul", ADR 0005), toujours une NOUVELLE revision qui se trouve
 * reproduire l'etat ancien. Lit l'instantane complet, non filtre — c'est
 * une operation serveur qui ne renvoie jamais ce contenu brut au client,
 * seulement l'entite mise a jour (meme forme que updateEntity).
 */
export async function restoreRevision(
  supabase: TypedClient,
  params: { entityId: string; revisionNumber: number; changedBy: string }
): Promise<RestoreRevisionResult> {
  const revision = await getEntityRevisionByNumber(supabase, params.entityId, params.revisionNumber);
  if (!revision) return { ok: false, reason: "not_found" };
  const current = await getEntityById(supabase, params.entityId);
  if (!current) return { ok: false, reason: "not_found" };

  const snapshot = normalizeStoredSnapshot(revision.snapshot);

  const { data: updatedEntity, error: updateError } = await supabase
    .from("entities")
    .update({
      name: snapshot.entity.name,
      entity_kind: snapshot.entity.entityKind,
      aliases: snapshot.entity.aliases,
      version: current.version + 1,
    })
    .eq("id", params.entityId)
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .single();
  if (updateError) throw new Error(updateError.message);

  // Revisions anterieures a ce ticket (hadCapturedBlocks = false) : aucun
  // bloc n'a jamais ete capture, un tableau vide serait une invention — ne
  // pas toucher aux blocs actuels plutot que les effacer sur la seule foi
  // d'une absence de donnee historique.
  if (hadCapturedBlocks(revision.snapshot)) {
    // Postgres exige, pour UPDATE/DELETE, que la ligne ciblee satisfasse
    // AUSSI la politique SELECT de la table — pas seulement celle de la
    // commande elle-meme (verifie empiriquement en testant cette
    // restauration). Un simple `delete().eq("entity_id", ...)` avec le
    // client de l'appelant laisserait donc silencieusement en place tout
    // bloc que cet appelant ne peut pas lui-meme lire (typiquement un bloc
    // `gm`, si l'appelant est un joueur) : ni erreur, ni ligne affectee.
    // `restore_entity_blocks` (migration 20260804160002) contourne cette
    // restriction de CIBLAGE via security definer, borne par is_world_member
    // — jamais une extension de qui peut ecrire (n'importe quel membre du
    // monde peut deja creer un bloc a n'importe quel niveau, cf. blocks_insert).
    const { error: restoreError } = await supabase.rpc("restore_entity_blocks", {
      p_entity_id: params.entityId,
      p_blocks: snapshot.blocks as unknown as Json,
    });
    if (restoreError) throw new Error(restoreError.message);
  }

  const restoredEntity = updatedEntity as EntitySummary;
  await recordEntityRevision(supabase, {
    entity: restoredEntity,
    changeSource: "user",
    changedBy: params.changedBy,
    changeNote: `Restauration de la revision ${params.revisionNumber}`,
  });

  return { ok: true, entity: restoredEntity };
}
