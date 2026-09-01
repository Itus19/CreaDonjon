import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canSee, type VisibilityLevel, type Viewer } from "@/src/core/visibility";
import { zMapBlockData } from "@/src/core/schemas/blocks/map";
import { getBlockById, listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEntityById, listEntitiesForWorld } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface MapSourceInfo {
  assetId: string | null;
  thumbnailAssetId: string | null;
  entityName: string;
}

/**
 * Resout un bloc `map` reference (`mode: "ref"`, ADR 0017 decision 1) en
 * image affichable pour CE viewer precis — jamais un `sourceBlockId` brut
 * envoye au client, qui n'a pas de sens sans re-verifier la visibilite du
 * bloc source (peut appartenir a une toute autre fiche, avec sa propre
 * visibilite). Meme motif que `getFamilyTree`/`getRelationsGraph` : une
 * seule fonction, appelee a la fois par l'editeur MJ (route authentifiee),
 * `getPlayerEntityDetail` et `getPublicEntityDetail` (viewer anonyme) —
 * jamais reimplementee par appelant.
 *
 * `null` si le bloc source n'existe pas, n'est pas un bloc `map`
 * propriétaire, ou n'est pas visible par ce viewer — jamais de distinction
 * entre ces cas, meme convention que le reste de l'app pour une ressource
 * hors de portee (ne jamais confirmer qu'un id "existe mais est cache").
 */
export async function resolveMapSource(
  supabase: TypedClient,
  sourceBlockId: string,
  viewer: Viewer
): Promise<MapSourceInfo | null> {
  const block = await getBlockById(supabase, sourceBlockId);
  if (!block || block.block_type !== "map") return null;

  const parsed = zMapBlockData.safeParse(block.data);
  if (!parsed.success || parsed.data.mode !== "own") return null;

  const visible = canSee(
    { level: block.visibility_level as VisibilityLevel, scopeId: block.visibility_scope_id, createdBy: block.created_by },
    viewer
  );
  if (!visible) return null;

  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) return null;
  // `is_public` ne s'applique qu'au viewer anonyme (wiki public/lien de
  // partage) — jamais aux membres authentifies du monde, meme motif que
  // `relationshipTarget` dans `playerEntityDetail.ts`.
  if (viewer.kind === "anonymous" && !entity.is_public) return null;

  return { assetId: parsed.data.assetId, thumbnailAssetId: parsed.data.thumbnailAssetId, entityName: entity.name };
}

export interface CarteOption {
  entityId: string;
  entityName: string;
  entitySlug: string;
  blockId: string;
}

/**
 * Fiches `carte` du monde, pour le selecteur "referencer une carte
 * existante" (Lot I, phase F₁) — jamais filtre par visibilite : cette
 * liste ne sert qu'a choisir un `sourceBlockId` (editeur MJ uniquement,
 * les joueurs n'ont pas d'affordance pour ajouter un bloc `map`,
 * V2-M7b), `resolveMapSource` ci-dessus reste le seul filtre reel au
 * moment de l'affichage.
 */
export async function listCarteOptions(supabase: TypedClient, worldId: string): Promise<CarteOption[]> {
  const entities = (await listEntitiesForWorld(supabase, worldId)).filter((e) => e.entity_kind === "carte");
  const blocks = await listBlocksByTypeForEntities(supabase, entities.map((e) => e.id), "map");
  const blockIdByEntity = new Map(blocks.map((b) => [b.entity_id, b.id]));

  const options: CarteOption[] = [];
  for (const entity of entities) {
    // `ensureMapBlock` (entities.ts) garantit sa presence ; defensif si un
    // appel direct au repo l'a un jour contourne.
    const blockId = blockIdByEntity.get(entity.id);
    if (!blockId) continue;
    options.push({ entityId: entity.id, entityName: entity.name, entitySlug: entity.slug, blockId });
  }
  return options.sort((a, b) => a.entityName.localeCompare(b.entityName));
}
