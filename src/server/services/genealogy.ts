import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { filterBlocks, isAdminViewer, type Viewer, type VisibilityLevel } from "@/src/core/visibility";
import { buildFamilyTree, type FamilyEdgeInput, type FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { listFamilyRelationsForWorld } from "@/src/server/repos/relations";
import { listEntitiesForWorld } from "@/src/server/repos/entities";
import { listPlayerVisibleEntityIds } from "@/src/server/services/entities";

type TypedClient = SupabaseClient<Database>;

/**
 * Construit l'arbre genealogique d'une fiche (V2-H3) : les aretes viennent
 * de `relations`, filtrees par visibilite AVANT de quitter le serveur — un
 * lien cache disparait de l'arbre POUR UN VISITEUR QUI N'Y A PAS DROIT
 * (joueur, wiki public), il ne s'affiche jamais grise (specs/wiki-blocs.md
 * §2, "le point sensible : les secrets de famille"). Meme fonction pour
 * l'editeur (`viewer` authentifie) et le wiki public (`viewer: {kind:
 * "anonymous"}`, publicShare.ts) — un seul calcul, jamais deux chemins qui
 * pourraient diverger sur ce qui est filtre.
 *
 * Pour le MJ (owner/editor, `canSee` bypasse tous les niveaux), rien n'est
 * retire — `FamilyEdgeInput.visibilityLevel` (V2, retour utilisateur point
 * 3) porte le niveau d'origine jusqu'au canevas, qui grise cote client les
 * liens qui n'apparaitront pas aux joueurs/au wiki public.
 */
export async function getFamilyTree(
  supabase: TypedClient,
  params: { worldId: string; rootEntityId: string; depthUp: number; depthDown: number; viewer: Viewer }
): Promise<FamilyTree> {
  const [rows, allEntities] = await Promise.all([
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

  // Fiche masquee : le visiteur anonyme perd les entites `is_public: false`
  // (V2, retour utilisateur point 2) ; un viewer authentifie NON admin
  // (joueur — retour utilisateur, "des fiches masquees aux joueurs
  // apparaissent quand meme") perd celles sans aucun bloc qui lui soit
  // visible, meme filtre et meme raison que `getEntityTree`/
  // `getEntityWindowData`. Le MJ/editeur/gm de campagne (`isAdminViewer`)
  // voit toujours tout. Filtre aussi les aretes qui touchent une entite
  // masquee (pas seulement la liste d'entites) : `buildFamilyTree`
  // (src/core, `entityById.get(id) as FamilyEntityInput`) suppose que toute
  // arete visible reference une entite presente dans la liste — la laisser
  // passer sans l'entite ferait planter le rendu au lieu de simplement
  // masquer le lien.
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

  const edges: FamilyEdgeInput[] = edgesVisible.map((r) => ({
    id: r.id,
    sourceId: r.source_entity_id,
    targetId: r.target_entity_id,
    relationType: r.relation_type,
    label: RELATION_LABELS_FR[r.relation_type] ?? r.relation_type,
    visibilityLevel: r.visibility_level,
  }));

  return buildFamilyTree({
    rootId: params.rootEntityId,
    depthUp: params.depthUp,
    depthDown: params.depthDown,
    edges,
    entities: entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entityKind: e.entity_kind })),
  });
}
