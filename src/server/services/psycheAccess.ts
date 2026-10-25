import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getBlockById, listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { getPersonalityEventEntityId } from "@/src/server/repos/psyche";
import { filtrerBlocsVisibles } from "@/src/server/services/blocks";
import { canUserEditEntity, isWorldAdmin } from "@/src/server/services/permissions";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/**
 * Gardes des souvenirs de Personnalité et de Convictions (`personality_events`,
 * journal partagé par les deux blocs). La RLS de cette table ne connaît que
 * l'appartenance au monde : sans ces gardes, un joueur lisait les souvenirs
 * d'un bloc réservé au MJ et pouvait en écrire (même faille que les
 * relations, corrigée en V3.1-71 par `relationshipFace.ts`).
 *
 * Lecture : le MJ, ou un bloc de ce type visible du lecteur sur cette fiche
 * (règle 5). Écriture : `canEditEntity` sur la fiche du bloc (règle 22).
 */

export type PoleBlockType = "personality" | "worldview";

export async function canReadPoleEvents(
  supabase: TypedClient,
  params: { entityId: string; blockType: PoleBlockType; userId: string }
): Promise<boolean> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return false;
  if (await isWorldAdmin(supabase, { worldId: entity.world_id, userId: params.userId })) return true;
  const [rows, viewer] = await Promise.all([
    listBlocksByTypeForEntities(supabase, [entity.id], params.blockType),
    buildViewerForWorld(supabase, entity.world_id, params.userId),
  ]);
  return filtrerBlocsVisibles(rows, viewer).length > 0;
}

/** Écrire un souvenir sur ce bloc : écrire sur sa fiche. */
export async function canWritePoleBlock(supabase: TypedClient, params: { blockId: string; userId: string }): Promise<boolean> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block) return false;
  return canWriteEntity(supabase, { entityId: block.entity_id, userId: params.userId });
}

/** Changer ce qui part au wiki d'un souvenir : écrire sur sa fiche. */
export async function canWritePoleEvent(supabase: TypedClient, params: { eventId: string; userId: string }): Promise<boolean> {
  const entityId = await getPersonalityEventEntityId(supabase, params.eventId);
  if (!entityId) return false;
  return canWriteEntity(supabase, { entityId, userId: params.userId });
}

async function canWriteEntity(supabase: TypedClient, params: { entityId: string; userId: string }): Promise<boolean> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return false;
  return canUserEditEntity(supabase, { worldId: entity.world_id, entityId: entity.id, userId: params.userId });
}
