import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug, listEntitiesForWorld, type EntitySummary } from "@/src/server/repos/entities";
import { listVisibleBlocks, type VisibleBlock } from "@/src/server/services/blocks";
import { listVisibleRelations, type VisibleRelation } from "@/src/server/services/relations";

type TypedClient = SupabaseClient<Database>;

export interface EntityWindowData {
  entity: EntitySummary;
  worldSlug: string;
  blocks: VisibleBlock[];
  relations: VisibleRelation[];
  otherEntities: { id: string; name: string; slug: string; entity_kind: string }[];
}

/**
 * Donnees d'une fiche pour une fenetre (ADR-0006) : la meme forme que ce
 * qu'attend `<EditEntityForm>`, qu'elle vienne du rendu serveur de la
 * fenetre primaire ou d'une recuperation client pour une fenetre `?avec=`.
 * `null` si le monde, la fiche ou l'utilisateur sont introuvables —
 * chaque appelant traduit ça dans son propre format (404 Next.js pour la
 * page, reponse JSON 404 pour la route API).
 */
export async function getEntityWindowData(
  supabase: TypedClient,
  worldSlug: string,
  entitySlug: string
): Promise<EntityWindowData | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [blocks, relations, allEntities] = await Promise.all([
    listVisibleBlocks(supabase, world.id, entity.id, user.id),
    listVisibleRelations(supabase, world.id, entity.id, user.id),
    listEntitiesForWorld(supabase, world.id),
  ]);

  const otherEntities = allEntities
    .filter((e) => e.id !== entity.id)
    .map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }));

  return { entity, worldSlug, blocks, relations, otherEntities };
}
