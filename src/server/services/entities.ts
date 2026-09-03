import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextNumericSlug } from "@/src/core/slug/slug";
import { buildEntityTree, withPlayerCharacterKinds, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import {
  type DeletedEntitySummary,
  type EntitySearchResult,
  type EntitySummary,
  findEntityByKind,
  getEntityById,
  insertEntity,
  listDeletedEntities,
  listEntitiesByIds,
  listEntitiesForWorld,
  listEntitySlugsForWorld,
  maxEntityDisplayOrderForKind,
  restoreEntity,
  searchEntitiesInWorld,
  softDeleteEntity,
  updateEntityWithVersionCheck,
  worldHasSlug,
} from "@/src/server/repos/entities";
import { zGeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { GENERATOR_TOOLS } from "@/src/core/generators/tools";
import { getWorldEntityKindOrder } from "@/src/server/repos/worlds";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { insertBlock, listBlockVisibilityForEntities, listBlocksForEntity, maxDisplayOrder } from "@/src/server/repos/blocks";
import { defaultBlockData, defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import type { Json } from "@/src/types/database";
import { listEntityGrantsForUser } from "@/src/server/repos/entityGrants";
import { getClaimedCharacterEntityId, listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { listPlayerCharacterEntityIds } from "@/src/server/services/worldPlayerCharacters";
import { canUserEditEntity, isWorldAdmin } from "@/src/server/services/permissions";
import { buildViewerForWorld } from "@/src/server/services/visibility";

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

/**
 * "Cette fiche a-t-elle au moins un bloc visible a ce viewer" (retour
 * utilisateur : "certaines fiches qui sont normalement masquées pour les
 * joueurs apparaissent quand même" — dans le sommaire du wiki joueur ET
 * dans les listes "lien vers une fiche" de l'outil Édition) — une entite
 * n'a pas de niveau de visibilite propre (seuls ses blocs en ont un),
 * donc c'est la definition retenue de "fiche visible a un joueur" en
 * l'absence d'un tel champ. Jamais applique au MJ (voir `isWorldAdmin`
 * chez les deux appelants) : lui doit continuer a tout voir, y compris
 * une fiche entierement vide de contenu visible.
 *
 * UNION avec `listPlayerEditableEntities` — bug reel trouve en testant en
 * direct (via "Voir comme") : une fiche toute neuve octroyee par le MJ
 * (`entity_grants`, ex. "A l'Ouest") mais encore VIDE de tout bloc
 * disparaissait de "lien vers une fiche" alors qu'elle reste deja
 * accessible en edition directe depuis le sommaire "Édition" — le joueur
 * la connait forcement deja, la masquer ailleurs aurait ete incoherent et
 * plus deroutant qu'une fiche simplement vide.
 */
export async function listPlayerVisibleEntityIds(supabase: TypedClient, worldId: string, entityIds: string[], userId: string): Promise<Set<string>> {
  const [rows, viewer, campaigns] = await Promise.all([
    listBlockVisibilityForEntities(supabase, entityIds),
    buildViewerForWorld(supabase, worldId, userId),
    listCampaignsForWorld(supabase, worldId),
  ]);
  const visible = filterBlocks(
    rows.map((r) => ({
      ...r,
      visibility: { level: r.visibility_level as VisibilityLevel, scopeId: r.visibility_scope_id, createdBy: r.created_by },
    })),
    viewer
  );
  const ids = new Set(visible.map((r) => r.entity_id));
  const editable = await listPlayerEditableEntities(supabase, { worldId, campaignId: campaigns[0]?.id ?? null, userId });
  for (const e of editable) ids.add(e.id);
  return ids;
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
  let visibleEntities = excludeOthersPrivateNotes(entities, userId);
  if (userId && !(await isWorldAdmin(supabase, { worldId, userId }))) {
    const visibleIds = await listPlayerVisibleEntityIds(supabase, worldId, visibleEntities.map((e) => e.id), userId);
    visibleEntities = visibleEntities.filter((e) => visibleIds.has(e.id));
  }
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

  if (updated.entity_kind === "carte") {
    await ensureMapBlock(supabase, updated.id, params.changedBy);
  }

  return { ok: true, entity: updated };
}

/**
 * Fiche `carte` (Lot I, retour utilisateur) : jamais d'ecran "Ajouter un
 * bloc" a chercher — des que le type passe a "carte", cette fiche montre
 * directement le canevas plein format (`EditEntityForm.tsx`), qui suppose
 * donc un bloc `map` deja present. Idempotent (verifie l'existant avant de
 * creer) : appele a chaque sauvegarde tant que le type reste "carte", pas
 * seulement a la transition.
 */
async function ensureMapBlock(supabase: TypedClient, entityId: string, createdBy: string): Promise<void> {
  const blocks = await listBlocksForEntity(supabase, entityId);
  if (blocks.some((b) => b.block_type === "map")) return;

  const displayOrder = (await maxDisplayOrder(supabase, entityId)) + 1000;
  await insertBlock(supabase, {
    entityId,
    blockType: "map",
    display: defaultBlockDisplay("map", "Carte"),
    data: defaultBlockData("map") as Json,
    displayOrder,
    visibilityLevel: "public",
    visibilityScopeId: null,
    createdBy,
  });
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
 * Entite "Générateurs de MJ" (V2-J1 Phase 2, entity_kind `generateur`) —
 * une par monde, singleton auto-provisionne (meme motif que `ensureMapBlock`
 * plus haut, a l'echelle de l'entite plutot que du bloc) : jamais creee par
 * l'ecran "Nouvelle fiche", seulement a la premiere ouverture de l'outil MJ
 * "Générateurs" (`GET /api/worlds/[worldSlug]/mj/generateurs/window`).
 * Chaque section de `GENERATOR_TOOLS` (src/core/generators/tools.ts) devient
 * un bloc `generator` marque de sa cle technique — un simple gabarit vide
 * (`defaultBlockData("generator")`, le meme que tout bloc generator neuf)
 * que l'auteur remplit ensuite lui-meme via l'editeur de bloc habituel
 * (RandomTableBlockEditor/GeneratorBlockEditor deja existants, aucune
 * nouvelle UI d'edition) : le CONTENU des tables (noms, ambiances...) est de
 * la donnee, jamais ecrite en dur ici (CLAUDE.md, "Saisir des règles").
 * Visibilite `gm` sur chaque bloc — jamais vue des joueurs, cf.
 * `listPlayerVisibleEntityIds` qui masque deja toute entite sans bloc
 * visible d'un joueur. Idempotent : n'ajoute que les sections manquantes.
 */
export async function ensureGeneratorToolsEntity(supabase: TypedClient, worldId: string, createdBy: string): Promise<string> {
  const existing = await findEntityByKind(supabase, worldId, "generateur");
  const entityId = existing
    ? existing.id
    : (
        await createEntity(supabase, {
          worldId,
          createdBy,
          name: "Générateurs de MJ",
          entityKind: "generateur",
          aliases: [],
        })
      ).id;

  const blocks = await listBlocksForEntity(supabase, entityId);
  const existingKeys = new Set(
    blocks
      .filter((b) => b.block_type === "generator")
      .map((b) => zGeneratorBlockData.safeParse(b.data))
      .filter((p) => p.success)
      .map((p) => (p.success ? p.data.key : undefined))
  );

  let displayOrder = (await maxDisplayOrder(supabase, entityId)) + 1000;
  for (const tool of GENERATOR_TOOLS) {
    for (const section of tool.sections) {
      if (existingKeys.has(section.key)) continue;
      await insertBlock(supabase, {
        entityId,
        blockType: "generator",
        display: defaultBlockDisplay("generator", section.label),
        data: { ...(defaultBlockData("generator") as Record<string, unknown>), key: section.key } as Json,
        displayOrder,
        visibilityLevel: "gm",
        visibilityScopeId: null,
        createdBy,
      });
      displayOrder += 1000;
    }
  }

  return entityId;
}

/** Journal d'historique, "rétablir une fiche supprimée" — appelant deja verifie MJ de ce monde (meme garde que le reste du journal), simple passe-plat. */
export async function listDeletedEntitiesForWorld(supabase: TypedClient, worldId: string): Promise<DeletedEntitySummary[]> {
  return listDeletedEntities(supabase, worldId);
}

export async function restoreDeletedEntity(
  supabase: TypedClient,
  id: string
): Promise<{ restored: boolean; error?: "forbidden" | "not_found" | "slug_conflict" }> {
  const result = await restoreEntity(supabase, id);
  if (!result.ok) return { restored: false, error: result.reason };
  return { restored: result.restored, error: result.restored ? undefined : "not_found" };
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

/**
 * Une requete vide ne vaut pas la peine d'un aller-retour base
 * (docs/BACKLOG.md V0-06). `userId` optionnel (retour utilisateur : "des
 * fiches masquees aux joueurs apparaissent quand meme" — meme filtre que
 * `getEntityTree`/`getEntityWindowData`, ici pour le selecteur d'objets
 * V1-B5 `ItemAutocomplete.tsx`, reutilise par les blocs Personnage/
 * Inventaire deja presents sur une fiche meme quand le joueur ne peut pas
 * en AJOUTER de nouveaux) : absent, comportement inchange (recherche
 * MJ/monde entier) — un appelant qui connait deja le viewer restreint le
 * filtre lui-meme.
 */
export async function searchEntities(
  supabase: TypedClient,
  worldId: string,
  query: string,
  userId?: string
): Promise<EntitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  const results = await searchEntitiesInWorld(supabase, worldId, trimmed);
  if (!userId || (await isWorldAdmin(supabase, { worldId, userId }))) return results;
  const visibleIds = await listPlayerVisibleEntityIds(supabase, worldId, results.map((r) => r.id), userId);
  return results.filter((r) => visibleIds.has(r.id));
}
