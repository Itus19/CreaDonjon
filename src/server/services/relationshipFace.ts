import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { listEntityIdsWithPortrait } from "@/src/server/repos/entityPortraits";
import { countAttitudeEvents } from "@/src/server/repos/psyche";
import { filtrerBlocsVisibles } from "@/src/server/services/blocks";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { listPlayerVisibleEntityIds } from "@/src/server/services/entities";
import { canUserEditEntity, isWorldAdmin } from "@/src/server/services/permissions";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-71 — le face-à-face du bloc Relation : ce que `source` ressent
 * envers `target`, en UNE lecture (C1, docs/CABLAGE.md).
 *
 * Le même appel, sens échangé, sert « ⇄ Voir l'autre sens » : le bloc
 * Relation de la cible envers la fiche n'est rendu que s'il est visible du
 * lecteur (règle 5, filtre de tous les blocs) ; « Créer ce bloc » n'est
 * proposé que si le lecteur peut écrire sur la cible (`canEditEntity`,
 * règle 22). Une cible invisible du lecteur ne livre ni son nom ni ses
 * valeurs.
 *
 * Le nombre de souvenirs et le dernier sont comptés ici, jamais stockés
 * (règle 16).
 */

export interface RelationshipFaceSide {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  hasPortrait: boolean;
}

export interface RelationshipFace {
  source: RelationshipFaceSide;
  /** `null` : la cible n'est pas visible du lecteur (rien d'elle ne part). */
  target: RelationshipFaceSide | null;
  campaignId: string | null;
  axes: Partial<Record<RelationshipAxisKey, number>>;
  souvenirs: { count: number; last: { occurredAtIngame: Json | null; createdAt: string } | null };
  /** Le bloc Relation de `source` qui vise `target`, s'il existe ET si le lecteur le voit. */
  block: { id: string; knownAs: string } | null;
  /** Le lecteur peut écrire sur `source` (donc y créer ce bloc). */
  canEditSource: boolean;
}

export async function getRelationshipFace(
  supabase: TypedClient,
  params: { sourceEntityId: string; targetEntityId: string; userId: string }
): Promise<RelationshipFace | null> {
  const source = await getEntityById(supabase, params.sourceEntityId);
  if (!source) return null;
  const worldId = source.world_id;

  const [admin, target] = await Promise.all([
    isWorldAdmin(supabase, { worldId, userId: params.userId }),
    getEntityById(supabase, params.targetEntityId),
  ]);
  const candidats = [source.id, ...(target && target.world_id === worldId ? [target.id] : [])];
  const visibles = admin ? new Set(candidats) : await listPlayerVisibleEntityIds(supabase, worldId, candidats, params.userId);
  if (!visibles.has(source.id)) return null;
  const cibleVisible = target !== null && visibles.has(target.id);

  const [portraits, viewer, blocs, canEditSource, campaignId] = await Promise.all([
    listEntityIdsWithPortrait(supabase, candidats),
    buildViewerForWorld(supabase, worldId, params.userId),
    listBlocksByTypeForEntities(supabase, [source.id], "relationship"),
    canUserEditEntity(supabase, { worldId, entityId: source.id, userId: params.userId }),
    resolveCampaignId(supabase, worldId),
  ]);

  const side = (e: { id: string; name: string; slug: string; entity_kind: string }): RelationshipFaceSide => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    entityKind: e.entity_kind,
    hasPortrait: portraits.has(e.id),
  });

  let block: RelationshipFace["block"] = null;
  for (const row of filtrerBlocsVisibles(blocs, viewer)) {
    const parsed = zRelationshipBlockData.safeParse(row.data);
    if (parsed.success && parsed.data.target?.kind === "entity" && parsed.data.target.id === params.targetEntityId) {
      block = { id: row.id, knownAs: parsed.data.knownAs };
      break;
    }
  }

  const vide = { count: 0, last: null };
  // Sans bloc visible, la relation n'existe pas pour ce lecteur : ni valeurs ni souvenirs (règle 5).
  if (!cibleVisible || !target || !block) {
    return { source: side(source), target: target && cibleVisible ? side(target) : null, campaignId, axes: {}, souvenirs: vide, block, canEditSource };
  }

  const [attitude, compte] = await Promise.all([
    getCurrentAttitude(supabase, worldId, source.id, target.id),
    campaignId
      ? countAttitudeEvents(supabase, { campaignId, sourceEntityId: source.id, targetEntityId: target.id })
      : Promise.resolve({ count: 0, last: null }),
  ]);

  return {
    source: side(source),
    target: side(target),
    campaignId,
    axes: attitude.axes,
    souvenirs: {
      count: compte.count,
      last: compte.last ? { occurredAtIngame: compte.last.occurred_at_ingame, createdAt: compte.last.created_at } : null,
    },
    block,
    canEditSource,
  };
}

/**
 * Garde de LECTURE des valeurs et souvenirs d'une paire (routes
 * `attitudes/[targetId]` et `…/events`). La RLS de `entity_attitudes` et
 * `attitude_events` ne connaît que l'appartenance au monde : sans ce garde,
 * un joueur lisait la relation d'un PNJ réservée au MJ. Le MJ lit tout ; un
 * joueur, seulement si un bloc Relation de la source vers la cible lui est
 * visible, et la cible aussi (règle 5).
 */
export async function canReadRelationship(
  supabase: TypedClient,
  params: { sourceEntityId: string; targetEntityId: string; userId: string }
): Promise<boolean> {
  const source = await getEntityById(supabase, params.sourceEntityId);
  if (!source) return false;
  if (await isWorldAdmin(supabase, { worldId: source.world_id, userId: params.userId })) return true;
  const face = await getRelationshipFace(supabase, params);
  return face !== null && face.block !== null && face.target !== null;
}

/** Garde d'ÉCRITURE d'un souvenir de relation : écrire sur la source (`canEditEntity`, règle 22). */
export async function canWriteRelationship(
  supabase: TypedClient,
  params: { sourceEntityId: string; userId: string }
): Promise<boolean> {
  const source = await getEntityById(supabase, params.sourceEntityId);
  if (!source) return false;
  return canUserEditEntity(supabase, { worldId: source.world_id, entityId: source.id, userId: params.userId });
}
