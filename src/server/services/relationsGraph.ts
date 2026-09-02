import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { filterBlocks, isAdminViewer, type Viewer, type VisibilityLevel } from "@/src/core/visibility";
import {
  buildRelationsGraph,
  type GraphEdgeInput,
  type GraphEntityInput,
  type RelationsGraph,
} from "@/src/core/relationsGraph/buildRelationsGraph";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { listAllRelationsForWorld } from "@/src/server/repos/relations";
import { listEntitiesForWorld } from "@/src/server/repos/entities";
import { listPlayerVisibleEntityIds } from "@/src/server/services/entities";

type TypedClient = SupabaseClient<Database>;

export interface RelationsGraphData {
  edges: GraphEdgeInput[];
  entities: GraphEntityInput[];
}

/**
 * Aretes + entites d'un monde, deja filtrees par visibilite — TOUT ce qui
 * precede le calcul du parcours en largeur (`buildRelationsGraph`), qui
 * lui seul depend de `maxDegree`. Extrait de `getRelationsGraph` (retour
 * utilisateur : "changer le degre met du temps a charger") — le degre
 * choisi ne change JAMAIS cette partie couteuse (deux requetes sur toute
 * la base du monde), seulement le parcours en largeur PUR (src/core, sans
 * reseau) applique par-dessus. `RelationsGraphBlockEditor.tsx` ne
 * recupere donc ces donnees qu'une fois par montage, puis recalcule le
 * graphe visible localement, sans aucun aller-retour serveur, a chaque
 * changement de degre.
 */
export async function getRelationsGraphData(
  supabase: TypedClient,
  params: { worldId: string; viewer: Viewer }
): Promise<RelationsGraphData> {
  const [rows, allEntities] = await Promise.all([
    listAllRelationsForWorld(supabase, params.worldId),
    listEntitiesForWorld(supabase, params.worldId),
  ]);

  const visible = filterBlocks(
    rows.map((r) => ({
      ...r,
      visibility: {
        level: r.visibility_level as VisibilityLevel,
        scopeId: r.visibility_scope_id,
        createdBy: r.created_by,
      },
    })),
    params.viewer
  );

  // Fiche masquee, meme filtre et meme raison que getFamilyTree.ts (retour
  // utilisateur, "des fiches masquees aux joueurs apparaissent quand
  // meme") : le visiteur anonyme perd les entites `is_public: false`, un
  // joueur authentifie (non admin) perd celles sans aucun bloc visible —
  // aretes touchant une entite masquee comprises, `buildRelationsGraph`
  // (src/core) suppose que toute arete visible reference une entite
  // presente dans la liste.
  const admin = isAdminViewer(params.viewer);
  let entities = allEntities;
  if (!admin) {
    if (params.viewer.kind === "anonymous") {
      entities = allEntities.filter((e) => e.is_public);
    } else {
      const visibleIds = await listPlayerVisibleEntityIds(supabase, params.worldId, allEntities.map((e) => e.id), params.viewer.userId);
      entities = allEntities.filter((e) => visibleIds.has(e.id));
    }
  }
  const visibleEntityIds = new Set(entities.map((e) => e.id));
  const edgesVisible = admin
    ? visible
    : visible.filter((r) => visibleEntityIds.has(r.source_entity_id) && visibleEntityIds.has(r.target_entity_id));

  const edges: GraphEdgeInput[] = edgesVisible.map((r) => ({
    id: r.id,
    sourceId: r.source_entity_id,
    targetId: r.target_entity_id,
    relationType: r.relation_type,
    label: RELATION_LABELS_FR[r.relation_type] ?? r.relation_type,
    visibilityLevel: r.visibility_level,
  }));

  return { edges, entities: entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entityKind: e.entity_kind })) };
}

/**
 * Construit le graphe de relations d'une fiche (V2-H1 phase 5) — memes
 * garanties que `getFamilyTree` (V2-H3) : les aretes viennent de
 * `relations`, filtrees par visibilite AVANT de quitter le serveur, meme
 * fonction pour l'editeur et le wiki public. Difference : tout type de
 * relation compte, pas seulement la famille.
 *
 * Simple composition de `getRelationsGraphData` + `buildRelationsGraph` —
 * gardee pour le wiki public, qui n'a pas de degre a changer en direct
 * (un seul calcul par affichage, jamais besoin du decoupage cote client).
 */
export async function getRelationsGraph(
  supabase: TypedClient,
  params: { worldId: string; rootEntityId: string; maxDegree: number; viewer: Viewer }
): Promise<RelationsGraph> {
  const { edges, entities } = await getRelationsGraphData(supabase, { worldId: params.worldId, viewer: params.viewer });
  return buildRelationsGraph({ rootId: params.rootEntityId, maxDegree: params.maxDegree, edges, entities });
}
