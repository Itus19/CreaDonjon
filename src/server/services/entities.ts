import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextNumericSlug } from "@/src/core/slug/slug";
import { buildEntityTree, withPlayerCharacterKinds, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import {
  type EntitySearchResult,
  type EntitySummary,
  getEntityById,
  insertEntity,
  listEntitiesByIds,
  listEntitiesForWorld,
  listEntitySlugsForWorld,
  maxEntityDisplayOrderForKind,
  searchEntitiesInWorld,
  softDeleteEntity,
  updateEntityWithVersionCheck,
  worldHasSlug,
} from "@/src/server/repos/entities";
import { getWorldEntityKindOrder } from "@/src/server/repos/worlds";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { insertBlock, listBlocksForEntity } from "@/src/server/repos/blocks";
import { listEntityGrantsForUser } from "@/src/server/repos/entityGrants";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { listPlayerCharacterEntityIds } from "@/src/server/services/worldPlayerCharacters";
import { canUserEditEntity } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/**
 * V2-M7b (Lot M) : exclut la fiche de notes privee d'un AUTRE compte —
 * `entity_kind = 'notes'` n'est jamais visible que de son createur
 * (`entities.created_by`), meme motif que `canEditEntity` (5e cas). Point
 * de filtrage unique : tout appelant de `listEntitiesForWorld` doit passer
 * par ici plutot que par le repo directement, jamais un second filtre
 * ecrit ailleurs.
 */
function excludeOthersPrivateNotes(entities: EntitySummary[], userId: string | null): EntitySummary[] {
  return entities.filter((e) => e.entity_kind !== "notes" || e.created_by === userId);
}

export async function listEntities(supabase: TypedClient, worldId: string, userId: string | null): Promise<EntitySummary[]> {
  const entities = await listEntitiesForWorld(supabase, worldId);
  return excludeOthersPrivateNotes(entities, userId);
}

/**
 * Fiches editables par un joueur dans ce monde (V2-M13, retour utilisateur :
 * "la liste à droite des fiches dont le joueur a l'accès d'édition") : son
 * propre personnage revendique (`campaign_characters`) + toute fiche de
 * lore octroyee par le MJ (`entity_grants`) — les deux memes cas que
 * `canEditEntity` (3 et 4), jamais un troisieme calcul divergent de qui a
 * le droit d'editer quoi.
 */
export async function listPlayerEditableEntities(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string | null; userId: string }
): Promise<EntitySummary[]> {
  const [claimedId, grants] = await Promise.all([
    params.campaignId ? getClaimedCharacterEntityId(supabase, { campaignId: params.campaignId, userId: params.userId }) : Promise.resolve(null),
    listEntityGrantsForUser(supabase, { worldId: params.worldId, userId: params.userId }),
  ]);
  // Personnage revendique en tete (retour utilisateur : la fiche la plus
  // probable a rouvrir), puis les octrois — un `Set` deduplique sans
  // perdre cet ordre d'insertion.
  const ids = new Set<string>();
  if (claimedId) ids.add(claimedId);
  for (const g of grants) ids.add(g.entity_id);
  if (ids.size === 0) return [];
  const byId = new Map((await listEntitiesByIds(supabase, [...ids])).map((e) => [e.id, e]));
  return [...ids].map((id) => byId.get(id)).filter((e): e is EntitySummary => e !== undefined);
}

/** Barre laterale (specs/coquille-et-design.md §4.3) : arborescence derivee, jamais saisie. */
export async function getEntityTree(
  supabase: TypedClient,
  worldId: string,
  userId: string | null
): Promise<EntityTreeGroup[]> {
  const [entities, partOfEdges, playerCharacterIds, kindOrder] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
    listPlayerCharacterEntityIds(supabase, worldId),
    getWorldEntityKindOrder(supabase, worldId),
  ]);
  const visibleEntities = excludeOthersPrivateNotes(entities, userId);
  return buildEntityTree(withPlayerCharacterKinds(visibleEntities, playerCharacterIds), partOfEdges, kindOrder);
}

/**
 * Slug numerique (V0-06g) : le titre d'une fiche est editable en place a
 * tout moment, un slug derive du nom au moment de la creation devient
 * trompeur des le premier renommage. Un numero ne represente jamais que
 * lui-meme. La collision (deux creations concurrentes calculant le meme
 * numero) reste possible en theorie — meme profil de risque que
 * l'ancienne verification "worldHasSlug puis retente" qu'elle remplace,
 * pas un nouveau risque introduit ici.
 */
async function generateUniqueEntitySlug(supabase: TypedClient, worldId: string): Promise<string> {
  const existingSlugs = await listEntitySlugsForWorld(supabase, worldId);
  let candidate = nextNumericSlug(existingSlugs);
  while (await worldHasSlug(supabase, worldId, candidate)) {
    candidate = String(Number(candidate) + 1);
  }
  return candidate;
}

/**
 * `isPublic: false` toujours, quel que soit l'appelant (creation vierge,
 * ajout a la volee depuis la genealogie, assistant de creation, import
 * d'un monde exporte...) — un seul choke point, "toute fiche nait masquee"
 * (V2, retour utilisateur point 2). Jamais un parametre que l'appelant
 * pourrait oublier de passer.
 */
export async function createEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    name: string;
    entityKind: string;
    aliases: string[];
  }
): Promise<EntitySummary> {
  const [slug, displayOrder] = await Promise.all([
    generateUniqueEntitySlug(supabase, params.worldId),
    maxEntityDisplayOrderForKind(supabase, params.worldId, params.entityKind).then((max) => max + 1000),
  ]);
  const entity = await insertEntity(supabase, { ...params, slug, displayOrder, isPublic: false });
  await recordEntityRevision(supabase, { entity, changeSource: "user", changedBy: params.createdBy });
  return entity;
}

export type UpdateEntityResult =
  | { ok: true; entity: EntitySummary }
  | { ok: false; reason: "conflict" | "not_found" | "forbidden" };

export async function updateEntity(
  supabase: TypedClient,
  params: {
    id: string;
    changedBy: string;
    expectedVersion: number;
    name: string;
    entityKind: string;
    aliases: string[];
    isPublic: boolean;
  }
): Promise<UpdateEntityResult> {
  // V2-M3 (Lot M) : `canEditEntity` avant toute ecriture — la RLS resserree
  // par la meme migration refuserait de toute facon l'appel a
  // `updateEntityWithVersionCheck`, mais l'appelant a alors besoin de
  // distinguer "refuse" de "conflit de version"/"introuvable", ce que RLS
  // seule ne permettrait pas (elle renverrait 0 ligne dans tous les cas).
  const existing = await getEntityById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntity(supabase, {
    worldId: existing.world_id,
    entityId: params.id,
    userId: params.changedBy,
  });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const updated = await updateEntityWithVersionCheck(supabase, params);
  if (!updated) {
    // Version perimee (l'existence et le droit d'ecrire viennent d'etre
    // confirmes juste au-dessus) : le seul cas restant est un conflit.
    return { ok: false, reason: "conflict" };
  }

  await recordEntityRevision(supabase, { entity: updated, changeSource: "user", changedBy: params.changedBy });

  return { ok: true, entity: updated };
}

/** Idempotent (voir softDeleteEntity) — un menu qui rappelle "Supprimer" deux fois de suite ne doit jamais lever d'erreur. */
export async function deleteEntity(
  supabase: TypedClient,
  params: { id: string; userId: string }
): Promise<{ deleted: boolean; error?: "not_found" | "forbidden" }> {
  const existing = await getEntityById(supabase, params.id);
  if (!existing) return { deleted: false, error: "not_found" };
  const allowed = await canUserEditEntity(supabase, {
    worldId: existing.world_id,
    entityId: params.id,
    userId: params.userId,
  });
  if (!allowed) return { deleted: false, error: "forbidden" };
  return softDeleteEntity(supabase, params.id);
}

/**
 * Copie la fiche (nouveau slug, nom suffixe) et ses blocs — jamais les
 * relations (un graphe de relations duplique serait ambigu : la copie
 * "parle" comme l'original a des entites qui, elles, n'ont pas change) ni
 * le portrait (V2-G7, hors perimetre demande).
 */
export async function duplicateEntity(
  supabase: TypedClient,
  params: { id: string; duplicatedBy: string }
): Promise<EntitySummary | null> {
  const original = await getEntityById(supabase, params.id);
  if (!original) return null;

  const [slug, displayOrder] = await Promise.all([
    generateUniqueEntitySlug(supabase, original.world_id),
    maxEntityDisplayOrderForKind(supabase, original.world_id, original.entity_kind).then((max) => max + 1000),
  ]);
  const copy = await insertEntity(supabase, {
    worldId: original.world_id,
    createdBy: params.duplicatedBy,
    slug,
    name: `${original.name} (copie)`,
    entityKind: original.entity_kind,
    aliases: original.aliases,
    displayOrder,
    // Contrairement a createEntity (toujours masquee) : une copie reprend
    // la visibilite de l'original, meme logique que les blocs copies juste
    // en dessous (visibilityLevel: block.visibility_level) — une fiche deja
    // publique dont on fait un doublon ne doit pas disparaitre du wiki.
    isPublic: original.is_public,
  });
  await recordEntityRevision(supabase, { entity: copy, changeSource: "user", changedBy: params.duplicatedBy });

  const blocks = await listBlocksForEntity(supabase, original.id);
  for (const block of blocks) {
    await insertBlock(supabase, {
      entityId: copy.id,
      blockType: block.block_type,
      display: block.display,
      data: block.data,
      displayOrder: block.display_order,
      visibilityLevel: block.visibility_level,
      visibilityScopeId: block.visibility_scope_id,
      createdBy: params.duplicatedBy,
    });
  }

  return copy;
}

/** Une requete vide ne vaut pas la peine d'un aller-retour base (docs/BACKLOG.md V0-06). */
export async function searchEntities(
  supabase: TypedClient,
  worldId: string,
  query: string
): Promise<EntitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  return searchEntitiesInWorld(supabase, worldId, trimmed);
}
