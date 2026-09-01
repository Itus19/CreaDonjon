import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { type BlockRow, listBlocksForEntity } from "@/src/server/repos/blocks";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { getPortraitLayout } from "@/src/server/services/entityPortraits";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { zGenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import { getFamilyTree } from "@/src/server/services/genealogy";
import { zMapBlockData } from "@/src/core/schemas/blocks/map";
import { resolveMapSource } from "@/src/server/services/mapSource";
import { zQuestBlockData } from "@/src/core/schemas/blocks/quest";
import { zTimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { zRelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";
import { getAttitudeEvents, getCurrentAttitude, getPersonalityEvents, getWorldviewEvents } from "@/src/server/services/psyche";
import { getRelationsGraph } from "@/src/server/services/relationsGraph";
import { getCalendar } from "@/src/server/services/worlds";
import { listVisibleRelations } from "@/src/server/services/relations";
import { listEntitiesForWorld, listEntitiesByIds, type EntitySummary } from "@/src/server/repos/entities";
import type { PublicBlock, PublicRelation } from "./publicShare";

type TypedClient = SupabaseClient<Database>;

function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as VisibilityLevel,
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Meme filtrage que `publicShare.ts` (filterTextBlockSegments) mais
 * parametre par un vrai viewer joueur plutot que fige a l'anonyme.
 * `createdBy: null` : un segment ne suit pas son auteur (aucun segment ne
 * le fait aujourd'hui) — "private" ne peut donc jamais se resoudre a vrai
 * pour personne, meme motif et meme comportement que la version publique,
 * jamais une regression introduite ici.
 */
function filterTextBlockSegmentsForViewer(blockType: string, data: Json, viewer: Awaited<ReturnType<typeof buildViewerForWorld>>): Json {
  if (blockType !== "text") return data;
  const parsed = zTextBlockData.safeParse(data);
  if (!parsed.success) return data;
  const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
  const segments = filterSegments(aware, viewer).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, segments } as unknown as Json;
}

function filterTimelineEntriesForViewer(blockType: string, data: Json, viewer: Awaited<ReturnType<typeof buildViewerForWorld>>): Json {
  if (blockType !== "timeline") return data;
  const parsed = zTimelineBlockData.safeParse(data);
  if (!parsed.success) return data;
  const aware = parsed.data.entries.map((entry) => ({ ...entry, visibility: { ...entry.visibility, createdBy: null } }));
  const entries = filterSegments(aware, viewer).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, entries } as unknown as Json;
}

/**
 * Meme forme que `PublicRelation` (`publicShare.ts`) mais pour un vrai
 * joueur authentifie — reutilise `listVisibleRelations` (deja le chemin
 * pour `EditEntityForm`), traduit juste le libelle comme le fait
 * `toPublicRelations` cote public.
 */
async function listPlayerRelations(supabase: TypedClient, worldId: string, entityId: string, userId: string): Promise<PublicRelation[]> {
  const rows = await listVisibleRelations(supabase, worldId, entityId, userId);
  return rows.map((r) => ({
    id: r.id,
    relationType: r.relationType,
    label: RELATION_LABELS_FR[r.label] ?? r.label,
    other: r.other,
  }));
}

/**
 * Fiche + blocs pour l'onglet Wiki de la coquille joueur (retour
 * utilisateur : "leur bouton de wiki [doit] permettre de visualiser le wiki
 * public mais... avec [leur] sidebar d'outil") — meme structure et memes
 * composants de rendu que `getPublicEntityDetail` (`PublicBlock`,
 * `PublicBlockView`, jamais un deuxieme rendu par type de bloc a
 * entretenir), mais avec la VRAIE visibilite du joueur authentifie
 * (`buildViewerForWorld`, deja le chemin de `listVisibleBlocks`) plutot que
 * celle, plus etroite, d'un visiteur anonyme — un contenu marque "players"
 * (ni public, ni prive a une personne) redevient donc visible ici, alors
 * qu'il resterait cache sur le lien de partage public.
 *
 * Client de l'appelant (RLS ordinaire), JAMAIS `service_role` — ce fichier
 * n'est pas `publicShare.ts`, la confinement de CLAUDE.md regle 4 ter reste
 * intact.
 *
 * Contrairement a `getPublicEntityDetail`, ne filtre pas sur `entity.is_public`
 * (reserve aux visiteurs anonymes — une fiche non publique peut deja etre
 * visible a un membre de campagne, meme motif que `listVisibleBlocks`).
 *
 * Portee volontairement bornee (retour utilisateur, ticket immediat) :
 * `personalityEvents`/`relationshipEvents` restent `onlyPublic: true` comme
 * la version publique — le modele de visibilite des souvenirs eux-memes
 * (potentiellement "players", pas seulement "public"/prive) resterait a
 * generaliser separement, hors de portee ici. `wikiBackground` omis : la
 * coquille joueur n'a pas (encore) de fond de page anime.
 */
export async function getPlayerEntityDetail(
  supabase: TypedClient,
  params: { worldId: string; entitySlug: string; userId: string }
): Promise<{ entity: EntitySummary; blocks: PublicBlock[]; relations: PublicRelation[]; portraitLayout: EntityPortraitLayout } | null> {
  const { worldId, entitySlug, userId } = params;
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  if (!entity) return null;

  const [rows, relations, portraitLayout, viewer] = await Promise.all([
    listBlocksForEntity(supabase, entity.id),
    listPlayerRelations(supabase, worldId, entity.id, userId),
    getPortraitLayout(supabase, entity.id),
    buildViewerForWorld(supabase, worldId, userId),
  ]);

  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);
  const blocks: PublicBlock[] = visible
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      data: filterTimelineEntriesForViewer(row.block_type, filterTextBlockSegmentsForViewer(row.block_type, row.data, viewer), viewer),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const blocksWithGenealogy = await Promise.all(
    blocks.map(async (block) => {
      if (block.blockType !== "genealogy") return block;
      const genealogyData = zGenealogyBlockData.parse(block.data);
      const genealogyTree = await getFamilyTree(supabase, {
        worldId,
        rootEntityId: genealogyData.rootEntityId ?? entity.id,
        depthUp: genealogyData.depthUp,
        depthDown: genealogyData.depthDown,
        viewer,
      });
      return { ...block, genealogyTree };
    })
  );

  const blocksWithRelationshipAxes = await Promise.all(
    blocksWithGenealogy.map(async (block) => {
      if (block.blockType === "personality") {
        const personalityEvents = await getPersonalityEvents(supabase, entity.id, true);
        return { ...block, personalityEvents };
      }
      if (block.blockType === "worldview") {
        const personalityEvents = await getWorldviewEvents(supabase, entity.id, true);
        return { ...block, personalityEvents };
      }
      if (block.blockType !== "relationship") return block;
      const relationshipData = zRelationshipBlockData.parse(block.data);
      if (relationshipData.target?.kind !== "entity") return block;
      const [{ axes }, [targetEntity], relationshipEvents] = await Promise.all([
        getCurrentAttitude(supabase, entity.id, relationshipData.target.id),
        listEntitiesByIds(supabase, [relationshipData.target.id]),
        getAttitudeEvents(supabase, entity.id, relationshipData.target.id, true),
      ]);
      return {
        ...block,
        relationshipAxes: axes,
        relationshipTarget: targetEntity ? { name: targetEntity.name, slug: targetEntity.slug } : null,
        relationshipEvents,
      };
    })
  );

  const blocksWithRelationsGraph = await Promise.all(
    blocksWithRelationshipAxes.map(async (block) => {
      if (block.blockType !== "relations_graph") return block;
      const graphData = zRelationsGraphBlockData.parse(block.data);
      const relationsGraph = await getRelationsGraph(supabase, {
        worldId,
        rootEntityId: graphData.rootEntityId ?? entity.id,
        maxDegree: graphData.degreesVisible,
        viewer,
      });
      return { ...block, relationsGraph };
    })
  );

  const hasDateFormattingBlock = blocksWithRelationsGraph.some(
    (b) =>
      b.blockType === "timeline" ||
      (b.blockType === "personality" && (b.personalityEvents?.length ?? 0) > 0) ||
      (b.blockType === "worldview" && (b.personalityEvents?.length ?? 0) > 0) ||
      (b.blockType === "relationship" && (b.relationshipEvents?.length ?? 0) > 0)
  );
  const timelineCalendar = hasDateFormattingBlock ? await getCalendar(supabase, worldId) : null;
  const blocksWithTimelineCalendar = blocksWithRelationsGraph.map((block) =>
    timelineCalendar &&
    (block.blockType === "timeline" || block.blockType === "personality" || block.blockType === "worldview" || block.blockType === "relationship")
      ? { ...block, timelineCalendar }
      : block
  );

  const hasQuestBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "quest");
  const hasTimelineBlockRefs = blocksWithTimelineCalendar.some((b) => b.blockType === "timeline");
  const entityLookup =
    hasQuestBlock || hasTimelineBlockRefs
      ? new Map((await listEntitiesForWorld(supabase, worldId)).map((e) => [e.id, { name: e.name, slug: e.slug }]))
      : null;
  const blocksWithQuestRefs = blocksWithTimelineCalendar.map((block) => {
    if (block.blockType === "timeline" && entityLookup) {
      const timeline = zTimelineBlockData.safeParse(block.data);
      if (!timeline.success) return block;
      const timelineRefs: Record<string, { name: string; slug: string }> = {};
      for (const entry of timeline.data.entries) {
        if (entry.ref?.kind !== "entity") continue;
        const found = entityLookup.get(entry.ref.id);
        if (found) timelineRefs[entry.ref.id] = found;
      }
      return { ...block, timelineRefs };
    }
    if (block.blockType !== "quest" || !entityLookup) return block;
    const quest = zQuestBlockData.safeParse(block.data);
    if (!quest.success) return block;
    const ids = new Set<string>();
    if (quest.data.giver?.kind === "entity") ids.add(quest.data.giver.id);
    for (const list of [quest.data.objectives, quest.data.rewards, quest.data.prerequisites]) {
      for (const item of list) if (item.ref?.kind === "entity") ids.add(item.ref.id);
    }
    const questRefs: Record<string, { name: string; slug: string }> = {};
    for (const id of ids) {
      const found = entityLookup.get(id);
      if (found) questRefs[id] = found;
    }
    return { ...block, questRefs };
  });

  // Carte referencee (Lot I, phase F₁) : meme resolution que
  // `getPublicEntityDetail`, avec le vrai viewer joueur plutot que
  // l'anonyme — `resolveMapSource` revalide la visibilite du bloc SOURCE
  // pour ce joueur precis avant de renvoyer son image.
  const blocksWithMapSource = await Promise.all(
    blocksWithQuestRefs.map(async (block) => {
      if (block.blockType !== "map") return block;
      const map = zMapBlockData.safeParse(block.data);
      if (!map.success || map.data.mode !== "ref") return block;
      const mapSource = await resolveMapSource(supabase, map.data.sourceBlockId, viewer);
      return { ...block, mapSource };
    })
  );

  return { entity, blocks: blocksWithMapSource, relations, portraitLayout };
}
