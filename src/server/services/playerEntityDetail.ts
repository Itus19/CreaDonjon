import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { collectRefTargetIds } from "@/src/core/linker/refTargets";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { type BlockRow, listBlocksForEntity } from "@/src/server/repos/blocks";
import {
  resolveEntityRefExcerpts,
  resolveRuleRefPreviews,
  warmRuleChain,
  type EntityRefPreview,
  type RuleRefPreview,
} from "@/src/server/services/refPreview";
import type { Locale } from "@/src/i18n/request";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { getPortraitLayout } from "@/src/server/services/entityPortraits";
import { getBackgroundMetaForBlock } from "@/src/server/services/blockImages";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { WikiBackground } from "@/src/server/services/publicShare";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { zGenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import { getFamilyTree } from "@/src/server/services/genealogy";
import { zMapBlockData } from "@/src/core/schemas/blocks/map";
import { resolveMapSource } from "@/src/server/services/mapSource";
import { listVisibleMapPins } from "@/src/server/services/mapPins";
import { listVisibleMapRegions } from "@/src/server/services/mapRegions";
import { resolveCampaignId } from "@/src/server/services/campaigns";
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
 * Les trois mémoïsations qui suivent sont le jumeau exact de celles de
 * `publicShare.ts` (V2.1-20 lot 2.1), et pour la même raison : le
 * `layout.tsx` de l'onglet Wiki a besoin du MÊME fond que la page, et doit le
 * payer une fois. `createClient` (lib/supabase/server.ts) est mémoïsé, donc le
 * client est stable sur toute la requête et `cache()` mord — ce qui ne serait
 * pas vrai avec une fabrique nue (la leçon de V2.1-19).
 *
 * Arguments primitifs uniquement : `cache()` compare par identité, et un objet
 * `params` construit à chaque appel rendrait la mémoïsation inerte sans que
 * rien ne le signale.
 *
 * Mémoïsé ICI, au niveau du service, jamais sur `listBlocksForEntity` ni sur
 * `buildViewerForWorld` : ces dépôts sont appelés depuis des chemins
 * d'ÉCRITURE, où une valeur figée par un appel antérieur serait un bug.
 */
const viewerFor = cache(function viewerFor(supabase: TypedClient, worldId: string, userId: string) {
  return buildViewerForWorld(supabase, worldId, userId);
});

const entityFor = cache(function entityFor(supabase: TypedClient, worldId: string, entitySlug: string) {
  return getEntityBySlug(supabase, worldId, entitySlug);
});

/** Les blocs d'une fiche, filtrés pour CE viewer — bloc puis segment, comme partout ailleurs. */
const getPlayerVisibleBlocks = cache(async function getPlayerVisibleBlocks(
  supabase: TypedClient,
  worldId: string,
  entitySlug: string,
  userId: string
): Promise<PublicBlock[]> {
  const entity = await entityFor(supabase, worldId, entitySlug);
  if (!entity) return [];

  const [rows, viewer] = await Promise.all([
    listBlocksForEntity(supabase, entity.id),
    viewerFor(supabase, worldId, userId),
  ]);

  return filterBlocks(rows.map(toVisibilityAware), viewer)
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      data: filterTimelineEntriesForViewer(row.block_type, filterTextBlockSegmentsForViewer(row.block_type, row.data, viewer), viewer),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
});

/**
 * Le fond de page wiki d'une fiche pour CE viewer, seul — sans le reste de la
 * fiche (V2.1-20 lot 2.1).
 *
 * Appelé par le `layout.tsx` de l'onglet Wiki pour poser les jetons de teinte
 * et la div de fond DANS LE HTML, et par la page dans SES DEUX branches : la
 * lecture comme l'éditeur. C'est la décision de l'auteur — une fiche éditable
 * porte le fond de sa fiche, comme en lecture. Elle referme du même coup une
 * incohérence plus ancienne que ce ticket : la branche éditable n'enregistrait
 * aucun fond, donc une navigation client depuis une fiche illustrée y
 * conservait le fond de la fiche PRÉCÉDENTE, alors qu'un chargement à froid
 * n'en avait aucun.
 *
 * Même garde que partout : le bloc de fond n'est cherché que parmi les blocs
 * déjà filtrés, donc un bloc réservé au MJ ne peut jamais imposer un fond à
 * une joueuse qui ne le voit pas.
 */
export const getPlayerWikiBackground = cache(async function getPlayerWikiBackground(
  supabase: TypedClient,
  worldId: string,
  entitySlug: string,
  userId: string
): Promise<WikiBackground | null> {
  const blocks = await getPlayerVisibleBlocks(supabase, worldId, entitySlug, userId);
  const backgroundBlock = blocks.find(
    (b) => b.blockType === "image" && (b.data as unknown as ImageBlockData).useAsWikiBackground
  );
  if (!backgroundBlock) return null;

  const meta = await getBackgroundMetaForBlock(supabase, backgroundBlock.id);
  if (!meta) return null;

  const data = backgroundBlock.data as unknown as ImageBlockData;
  return {
    imageUrl: data.url,
    blurPx: data.backgroundBlurPx,
    fadeMs: data.fadeMs,
    hue: meta.hue,
    chroma: meta.chroma,
    mode: meta.availableModes[0] ?? "dark",
  };
});

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
 * generaliser separement, hors de portee ici.
 *
 * V2.1-12 : `wikiBackground` est resolu pour cette route aussi — la coquille
 * joueur monte la meme peau que l'apercu (`BookSkin`) et porte donc le meme
 * fond de page.
 *
 * V2.1-20 lot 2.1 : cette resolution ne vit plus ICI mais dans
 * `getPlayerWikiBackground` ci-dessus, parce que le `layout.tsx` en a besoin
 * lui aussi — pour poser les jetons de teinte dans le HTML plutot que de les
 * laisser apparaitre apres l'hydratation. Les deux passent par la meme
 * fonction memoisee : une seule lecture pour la page et la coquille. La garde
 * n'a pas bouge — le bloc de fond est cherche parmi les blocs DEJA filtres,
 * jamais parmi les blocs bruts.
 */
export async function getPlayerEntityDetail(
  supabase: TypedClient,
  /** `locale` (V2.1-18 lot 2) : sert uniquement a choisir la traduction d'une fiche de REGLE citee, comme pour `getPublicEntityDetail`. */
  params: { worldId: string; entitySlug: string; userId: string; locale?: Locale }
): Promise<{
  entity: EntitySummary;
  blocks: PublicBlock[];
  relations: PublicRelation[];
  portraitLayout: EntityPortraitLayout;
  wikiBackground: WikiBackground | null;
} | null> {
  const { worldId, entitySlug, userId, locale = "fr" } = params;
  const entity = await entityFor(supabase, worldId, entitySlug);
  if (!entity) return null;

  // Les blocs et le fond passent par les mêmes fonctions mémoïsées que le
  // `layout.tsx` (V2.1-20 lot 2.1) : une seule lecture pour les deux, et
  // `cache()` mémoïse la promesse, donc celui qui arrive second attend le
  // même appel plutôt que d'en lancer un identique.
  const [blocks, relations, portraitLayout, viewer, campaignId, wikiBackground] = await Promise.all([
    getPlayerVisibleBlocks(supabase, worldId, entitySlug, userId),
    listPlayerRelations(supabase, worldId, entity.id, userId),
    getPortraitLayout(supabase, entity.id),
    viewerFor(supabase, worldId, userId),
    resolveCampaignId(supabase, worldId),
    getPlayerWikiBackground(supabase, worldId, entitySlug, userId),
    // V2.1-20 lot 5 — voir `publicShare.ts` : la chaine de rulesets ne depend
    // que du monde, elle n'a aucune raison d'attendre que les cles de regle
    // soient collectees trois vagues plus loin. Rechauffee ici, elle est deja
    // resolue quand `resolveRuleRefPreviews` la redemande. Le resultat n'est
    // pas nomme : c'est la memoisation qui le transporte.
    warmRuleChain(supabase, worldId),
  ]);

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
        getCurrentAttitude(supabase, entity.world_id, entity.id, relationshipData.target.id),
        listEntitiesByIds(supabase, [relationshipData.target.id]),
        getAttitudeEvents(supabase, entity.world_id, entity.id, relationshipData.target.id, true),
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
      (b.blockType === "relationship" && (b.relationshipEvents?.length ?? 0) > 0) ||
      b.blockType === "session_journal_meta"
  );
  const timelineCalendar = hasDateFormattingBlock ? await getCalendar(supabase, worldId) : null;
  const blocksWithTimelineCalendar = blocksWithRelationsGraph.map((block) =>
    timelineCalendar &&
    (block.blockType === "timeline" ||
      block.blockType === "personality" ||
      block.blockType === "worldview" ||
      block.blockType === "relationship" ||
      block.blockType === "session_journal_meta")
      ? { ...block, timelineCalendar }
      : block
  );

  const hasQuestBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "quest");
  const hasTimelineBlockRefs = blocksWithTimelineCalendar.some((b) => b.blockType === "timeline");
  const hasTextBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "text");
  const entityLookup =
    hasQuestBlock || hasTimelineBlockRefs || hasTextBlock
      ? new Map(
          (await listEntitiesForWorld(supabase, worldId)).map((e) => [e.id, { name: e.name, slug: e.slug, kind: e.entity_kind }])
        )
      : null;

  // V2.1-18 lot 2 — meme resolution que `getPublicEntityDetail`, avec le vrai
  // viewer joueur plutot que l'anonyme : l'extrait d'une fiche citee suit
  // exactement les memes regles de visibilite que son corps.
  const referencedEntityIds = new Set<string>();
  const referencedRuleKeys = new Set<string>();
  if (hasTextBlock && entityLookup) {
    for (const block of blocksWithTimelineCalendar) {
      if (block.blockType !== "text") continue;
      const text = zTextBlockData.safeParse(block.data);
      if (!text.success) continue;
      const { entityIds, ruleKeys } = collectRefTargetIds(text.data.segments);
      for (const id of entityIds) if (entityLookup.has(id)) referencedEntityIds.add(id);
      for (const key of ruleKeys) referencedRuleKeys.add(key);
    }
  }
  const [entityExcerpts, ruleRefsByKey] = await Promise.all([
    resolveEntityRefExcerpts(supabase, [...referencedEntityIds], viewer),
    resolveRuleRefPreviews(supabase, worldId, [...referencedRuleKeys], locale),
  ]);

  const blocksWithQuestRefs = blocksWithTimelineCalendar.map((block) => {
    if (block.blockType === "text" && entityLookup) {
      const text = zTextBlockData.safeParse(block.data);
      if (!text.success) return block;
      const { entityIds, ruleKeys } = collectRefTargetIds(text.data.segments);
      const textRefs: Record<string, EntityRefPreview> = {};
      for (const id of entityIds) {
        const found = entityLookup.get(id);
        if (found) textRefs[id] = { ...found, excerpt: entityExcerpts.get(id) ?? null };
      }
      const ruleRefs: Record<string, RuleRefPreview> = {};
      for (const key of ruleKeys) {
        const found = ruleRefsByKey[key];
        if (found) ruleRefs[key] = found;
      }
      return { ...block, textRefs, ruleRefs };
    }
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

  // Carte (Lot I, phases C, D et F₁) : meme resolution que
  // `getPublicEntityDetail`, avec le vrai viewer joueur plutot que
  // l'anonyme — voir son commentaire pour le detail own/ref.
  const blocksWithMapSource = await Promise.all(
    blocksWithQuestRefs.map(async (block) => {
      if (block.blockType !== "map") return block;
      const map = zMapBlockData.safeParse(block.data);
      if (!map.success) return block;
      if (map.data.mode === "own") {
        const [mapPins, mapRegions] = await Promise.all([
          listVisibleMapPins(supabase, block.id, viewer),
          listVisibleMapRegions(supabase, block.id, viewer, campaignId),
        ]);
        return { ...block, mapPins, mapRegions };
      }
      const mapSource = await resolveMapSource(supabase, map.data.sourceBlockId, viewer);
      const [mapPins, mapRegions] = mapSource
        ? await Promise.all([
            listVisibleMapPins(supabase, map.data.sourceBlockId, viewer),
            listVisibleMapRegions(supabase, map.data.sourceBlockId, viewer, campaignId),
          ])
        : [[], []];
      return { ...block, mapSource, mapPins, mapRegions };
    })
  );


  return { entity, blocks: blocksWithMapSource, relations, portraitLayout, wikiBackground };
}
