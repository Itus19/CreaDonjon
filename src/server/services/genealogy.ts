import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { filterBlocks, type Viewer, type VisibilityLevel } from "@/src/core/visibility";
import { buildFamilyTree, type FamilyEdgeInput, type FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { listFamilyRelationsForWorld } from "@/src/server/repos/relations";
import { listEntitiesForWorld } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

/**
 * Construit l'arbre genealogique d'une fiche (V2-H3) : les aretes viennent
 * de `relations`, filtrees par visibilite AVANT de quitter le serveur — un
 * lien cache disparait de l'arbre, il ne s'affiche jamais grise
 * (specs/wiki-blocs.md §2, "le point sensible : les secrets de famille").
 * Meme fonction pour l'editeur (`viewer` authentifie) et le wiki public
 * (`viewer: {kind: "anonymous"}`, publicShare.ts) — un seul calcul, jamais
 * deux chemins qui pourraient diverger sur ce qui est filtre.
 */
export async function getFamilyTree(
  supabase: TypedClient,
  params: { worldId: string; rootEntityId: string; depthUp: number; depthDown: number; viewer: Viewer }
): Promise<FamilyTree> {
  const [rows, entities] = await Promise.all([
    listFamilyRelationsForWorld(supabase, params.worldId),
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

  const edges: FamilyEdgeInput[] = visible.map((r) => ({
    id: r.id,
    sourceId: r.source_entity_id,
    targetId: r.target_entity_id,
    relationType: r.relation_type,
    label: RELATION_LABELS_FR[r.relation_type] ?? r.relation_type,
  }));

  return buildFamilyTree({
    rootId: params.rootEntityId,
    depthUp: params.depthUp,
    depthDown: params.depthDown,
    edges,
    entities: entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entityKind: e.entity_kind })),
  });
}
