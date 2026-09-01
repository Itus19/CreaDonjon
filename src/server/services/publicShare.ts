import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { createShareLinkServiceClient } from "@/lib/supabase/service";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import { verifySharePassword } from "@/src/core/shareLinks/password";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { relationLabel, type RelationType } from "@/src/core/relations/inverses";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { type BlockRow, getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";
import { getBlockImage, type BlockImage } from "@/src/server/repos/blockImages";
import { getBackgroundMetaForBlock } from "@/src/server/services/blockImages";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import { type EntitySummary, getEntityById, getEntityBySlug, listEntitiesForWorld } from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld, listRelationsForEntity, type OtherEntityRef } from "@/src/server/repos/relations";
import { listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { getWorldById, getWorldEntityKindOrder } from "@/src/server/repos/worlds";
import { getPortraitLayout } from "@/src/server/services/entityPortraits";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { zGenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import { getFamilyTree } from "@/src/server/services/genealogy";
import { zMapBlockData } from "@/src/core/schemas/blocks/map";
import { resolveMapSource, type MapSourceInfo } from "@/src/server/services/mapSource";
import { listVisibleMapPins, type VisibleMapPin } from "@/src/server/services/mapPins";
import type { FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import { zQuestBlockData } from "@/src/core/schemas/blocks/quest";
import { buildEntityTree, withPlayerCharacterKinds, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import { listPlayerCharacterEntityIds } from "@/src/server/services/worldPlayerCharacters";
import { zTimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { zRelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";
import {
  getAttitudeEvents,
  getCurrentAttitude,
  getPersonalityEvents,
  getWorldviewEvents,
} from "@/src/server/services/psyche";
import type { AttitudeEventRow, PersonalityEventRow } from "@/src/server/repos/psyche";
import { getRelationsGraph } from "@/src/server/services/relationsGraph";
import type { RelationsGraph } from "@/src/core/relationsGraph/buildRelationsGraph";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";
import { getCalendar } from "@/src/server/services/worlds";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Seul fichier ou `createShareLinkServiceClient` (lib/supabase/service.ts)
 * est construit et utilise — verifie mecaniquement par une regle ESLint
 * (eslint.config.mjs), pas seulement par convention (V1 D-01). Les pages
 * publiques (app/partage/**) n'importent jamais de client Supabase : elles
 * appellent les fonctions d'ici avec un jeton ou un world_id deja valide,
 * jamais l'inverse.
 */
function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface ResolvedShareLink {
  worldId: string;
  worldName: string;
  worldSlug: string;
  scope: string;
  /** Jamais transmis au client — sert uniquement a decider si la page doit demander un mot de passe avant tout chargement de contenu (V1-C4). */
  passwordHash: string | null;
  passwordAttempts: number;
}

/**
 * Passe par la fonction `security definer` public.resolve_share_link
 * (migration 20260801140001) : la cle anon suffit, aucune session
 * necessaire (la fonction est grantee a `anon`) — pas besoin du client
 * service-role pour cette seule verification. `null` couvre aussi bien
 * "jamais existe" que "expire"/"revoque" — jamais de distinction cote
 * appelant (docs/BACKLOG.md V0-07, ne pas reveler qu'un lien a existe).
 */
export async function resolveShareLink(token: string): Promise<ResolvedShareLink | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("resolve_share_link", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    worldId: row.world_id,
    worldName: row.world_name,
    worldSlug: row.world_slug,
    scope: row.scope,
    passwordHash: row.password_hash,
    passwordAttempts: row.password_attempts,
  };
}

/** Au-dela, le mot de passe ne protege plus rien (specs/arbitrage-modifications.md §3.2, "sinon le mot de passe ne protege rien") — le lien reste utilisable via son jeton, mais plus de nouvelle tentative de mot de passe. */
const MAX_PASSWORD_ATTEMPTS = 10;

export type SharePasswordResult = "ok" | "wrong" | "locked" | "not_required";

/**
 * Verifie le mot de passe d'un lien de partage et journalise la tentative
 * (`app.record_share_link_password_attempt`, meme fonction `security
 * definer` que `resolve_share_link` — l'anon n'a pas d'acces RLS en
 * ecriture a `share_links`). Ne fait jamais confiance a un `resolved` deja
 * en main : re-resout le jeton pour lire le compteur de tentatives a jour,
 * au cas ou plusieurs essais arrivent en parallele.
 */
export async function verifyShareLinkPassword(token: string, password: string): Promise<SharePasswordResult> {
  const resolved = await resolveShareLink(token);
  if (!resolved) return "wrong";
  if (!resolved.passwordHash) return "not_required";
  if (resolved.passwordAttempts >= MAX_PASSWORD_ATTEMPTS) return "locked";

  const success = verifySharePassword(password, resolved.passwordHash);

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("record_share_link_password_attempt", { p_token: token, p_success: success });
  if (error) throw new Error(error.message);

  return success ? "ok" : "wrong";
}

/**
 * La plupart des entites ne portent pas de visibilite propre (SCHEMA.md
 * §5) — seuls leurs blocs/segments en portent une. Exception delimitee
 * (V2, retour utilisateur point 2) : `is_public` bascule la fiche entiere,
 * un simple binaire distinct des 6 niveaux de `visibility_level`. Un
 * visiteur anonyme ne voit donc plus la meme liste de noms qu'un membre du
 * monde — les fiches masquees disparaissent ici, avant meme d'atteindre
 * `buildEntityTree`.
 *
 * `worldId` doit deja venir d'un `resolveShareLink` reussi — cette
 * fonction ne revalide rien elle-meme, elle fait confiance a l'appelant
 * (les deux pages publiques, qui appellent toujours resolveShareLink
 * d'abord). Ne jamais l'exposer sur un chemin qui accepte un world_id
 * venu directement d'un visiteur sans validation prealable.
 */
export async function listPublicEntities(worldId: string): Promise<EntitySummary[]> {
  const supabase = createShareLinkServiceClient();
  const entities = await listEntitiesForWorld(supabase, worldId);
  return entities.filter((e) => e.is_public);
}

/**
 * Sommaire hiérarchique pour la peau « livre » (V2-G2) : même arborescence
 * que la barre latérale d'édition (`getEntityTree`,
 * `src/server/services/entities.ts`), même fonction pure `buildEntityTree`
 * — seule la source des lignes change (client `service_role`, jamais de
 * session necessaire, comme `listPublicEntities` ci-dessus).
 *
 * Filtre par `is_public` AVANT `buildEntityTree` (pas apres) : une fiche
 * masquee ne doit jamais apparaitre comme racine ni comme enfant. Les
 * aretes `part_of` qui pointent vers une entite filtree restent dans
 * `partOfEdges` sans etre retirees a la main — `buildEntityTree` est pure
 * et ignore deja toute arete dont une extremite est absente de la liste
 * (elle compare alors `undefined !== <kind>`), l'enfant public d'un parent
 * masque redevient simplement une racine plutot que de disparaitre ou de
 * planter.
 */
export async function getPublicEntityTree(worldId: string): Promise<EntityTreeGroup[]> {
  const supabase = createShareLinkServiceClient();
  const [allEntities, partOfEdges, playerCharacterIds, kindOrder] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
    listPlayerCharacterEntityIds(supabase, worldId),
    getWorldEntityKindOrder(supabase, worldId),
  ]);
  const entities = allEntities.filter((e) => e.is_public);
  return buildEntityTree(withPlayerCharacterKinds(entities, playerCharacterIds), partOfEdges, kindOrder);
}

/**
 * Nom de la campagne du monde, affiché dans la peau « livre » à la place du
 * nom du monde (retour utilisateur) — « un monde = une campagne » (décision
 * produit, migration 20260826100001), donc au plus une ligne non supprimée.
 * `null` si le monde n'a pas encore de campagne (fiche appelante retombe
 * alors sur le nom du monde).
 */
export async function getPublicCampaignName(worldId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  const campaigns = await listCampaignsForWorld(supabase, worldId);
  return campaigns[0]?.name ?? null;
}

/**
 * Message d'accueil personnalise (V2-G2, extension) : `null` si la personne
 * n'a rien saisi — l'appelant retombe alors sur un message calcule (nom de
 * la campagne), jamais stocke tant qu'il n'est pas personnalise.
 */
export async function getPublicWikiWelcomeMessage(worldId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  const world = await getWorldById(supabase, worldId);
  return world?.wiki_welcome_message ?? null;
}

export interface PublicRelation {
  id: string;
  relationType: string;
  label: string;
  other: OtherEntityRef;
}

/**
 * Meme filtrage que listVisibleRelations (src/server/services/relations.ts),
 * pour un visiteur anonyme plutot qu'un utilisateur authentifie —
 * filterBlocks (src/core/visibility) est generique sur toute ligne
 * {visibility}, deja reutilise ici pour les blocs. Retire en plus toute
 * relation dont la CIBLE est une fiche masquee (V2, retour utilisateur
 * point 2) : sinon le nom et le lien mort de la fiche cachee fuiraient
 * quand meme via la relation, meme si la relation elle-meme est publique.
 */
function toPublicRelations(rows: Awaited<ReturnType<typeof listRelationsForEntity>>): PublicRelation[] {
  const visible = filterBlocks(
    rows
      .filter((r) => r.other.is_public)
      .map((r) => ({
        ...r,
        visibility: { level: r.visibility_level as VisibilityLevel, scopeId: r.visibility_scope_id, createdBy: r.created_by },
      })),
    { kind: "anonymous" }
  );
  return visible.map((r) => {
    const rawLabel = relationLabel(r.relation_type as RelationType, r.direction);
    return {
      id: r.id,
      relationType: r.relation_type,
      // Meme traduction que RelationsChips.tsx (fiche d'edition,
      // RELATION_LABELS_FR) — jamais la cle brute ("friend_of") affichee au
      // visiteur du wiki.
      label: RELATION_LABELS_FR[rawLabel] ?? rawLabel,
      other: r.other,
    };
  });
}

export interface PublicBlock {
  id: string;
  blockType: string;
  display: BlockDisplay;
  data: Json;
  displayOrder: number;
  /** Calcule cote serveur pour les blocs `genealogy` seulement (V2-H3) — voir plus bas dans `getPublicEntityDetail`. */
  genealogyTree?: FamilyTree;
  /** Blocs `quest` seulement (V2-H4) : nom/slug des entites referencees par un objectif/une recompense/un prerequis/le commanditaire — la donnee du bloc ne porte que des id, jamais assez pour un lien lisible cote public. */
  questRefs?: Record<string, { name: string; slug: string }>;
  /** Blocs `relationship` seulement (V2-H2, "juste la partie schema") : les axes ne vivent pas dans la donnee du bloc (portee campagne, entity_attitudes) — resolus ici pour le radar public. */
  relationshipAxes?: Partial<Record<RelationshipAxisKey, number>>;
  /** Blocs `relationship` seulement : nom/slug de la cible, pour legender le radar ("Envers X") — la donnee du bloc ne porte que son id. `null` si la cible n'existe plus/n'est pas resolvable. */
  relationshipTarget?: { name: string; slug: string } | null;
  /** Blocs `personality`/`worldview` seulement (V2, retour utilisateur point 5) : souvenirs marques `is_public`, deja filtres — table optionnelle sous le radar, absente si aucun souvenir n'est public. */
  personalityEvents?: PersonalityEventRow[];
  /** Bloc `relationship` seulement, meme motif que `personalityEvents`. */
  relationshipEvents?: AttitudeEventRow[];
  /** Blocs `relations_graph` seulement (V2-H2) : meme fonction que l'editeur, viewer anonyme (getRelationsGraph deja concue pour les deux, voir son commentaire). */
  relationsGraph?: RelationsGraph;
  /** Blocs `timeline` seulement (V2-H2) : calendrier du monde, necessaire a `TimelineAxis` pour placer les entrees (deja filtrees, voir `filterTimelineEntries`) — jamais dans la donnee du bloc lui-meme. */
  timelineCalendar?: CalendarConfigInput;
  /** Blocs `timeline` seulement : nom/slug des entites promues referencees par une entree (`entry.ref`) — meme motif que `questRefs`, la donnee du bloc ne porte que des id. */
  timelineRefs?: Record<string, { name: string; slug: string }>;
  /** Blocs `map` en mode "ref" seulement (Lot I, phase F₁) : image resolue du bloc source pour CE viewer — jamais le `sourceBlockId` brut envoye tel quel, sa visibilite propre doit etre revalidee ici (`resolveMapSource`). `null` si le bloc source n'existe pas/n'est plus visible. */
  mapSource?: MapSourceInfo | null;
  /** Blocs `map` seulement, own ET ref (Lot I, phase C) : punaises deja filtrees par visibilite pour CE viewer (`listVisibleMapPins`) — un bloc "ref" recoit les punaises du bloc SOURCE (ADR 0017 decision 1, "modifier une punaise sur le bloc proprietaire la modifie partout"). */
  mapPins?: VisibleMapPin[];
}

function filterTextBlockSegments(blockType: string, data: Json): Json {
  if (blockType !== "text") return data;
  const parsed = zTextBlockData.safeParse(data);
  if (!parsed.success) return data;
  // Segment.visibility n'a pas de createdBy (aucun segment ne le suit
  // aujourd'hui) : "private" ne peut donc jamais se resoudre a vrai pour
  // personne, deja le cas avant ce ticket — pas une regression introduite
  // ici, juste la premiere fois que filterSegments s'execute pour de vrai.
  const aware = parsed.data.segments.map((segment) => ({
    ...segment,
    visibility: { ...segment.visibility, createdBy: null },
  }));
  const segments = filterSegments(aware, { kind: "anonymous" }).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, segments } as unknown as Json;
}

/** Meme motif que `filterTextBlockSegments` : la visibilite du bloc `timeline` ne suffit pas, chaque entree porte la sienne (specs/wiki-blocs.md §3) — jamais une entree `gm` qui fuit parce que le bloc lui-meme est public. */
function filterTimelineEntries(blockType: string, data: Json): Json {
  if (blockType !== "timeline") return data;
  const parsed = zTimelineBlockData.safeParse(data);
  if (!parsed.success) return data;
  const aware = parsed.data.entries.map((entry) => ({
    ...entry,
    visibility: { ...entry.visibility, createdBy: null },
  }));
  const entries = filterSegments(aware, { kind: "anonymous" }).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, entries } as unknown as Json;
}

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
 * Entite + blocs filtres pour un visiteur anonyme (Viewer={kind:"anonymous"},
 * src/core/visibility) : la meme fonction pure canSee que pour tout autre
 * lecteur, jamais reimplementee en SQL — un seul endroit ou une visibilite
 * peut fuir, deja teste exhaustivement (voir aussi le test d'integration
 * publicShare.integration.test.ts, V1 D-01).
 *
 * Meme remarque que listPublicEntities : `worldId` doit deja venir d'un
 * `resolveShareLink` reussi.
 */
export interface WikiBackground {
  /** Servie par la meme route que le contenu du bloc (`/api/blocks/[id]/image`) — revalide la visibilite a chaque chargement, jamais un raccourci. */
  imageUrl: string;
  blurPx: number;
  fadeMs: number;
  hue: number;
  chroma: number;
  /** Premier mode de `available_modes` (`src/core/theme/oklch.ts`, deja ordonne dark→dim→soft→light) : garde un contraste texte/fond lisible. */
  mode: string;
}

export async function getPublicEntityDetail(
  worldId: string,
  entitySlug: string,
): Promise<
  {
    entity: EntitySummary;
    blocks: PublicBlock[];
    relations: PublicRelation[];
    portraitLayout: EntityPortraitLayout;
    wikiBackground: WikiBackground | null;
  }
  | null
> {
  const supabase = createShareLinkServiceClient();
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  // Fiche masquee (V2, retour utilisateur point 2) : meme reponse que
  // "n'existe pas", jamais de distinction qui revelerait qu'une fiche
  // cachee existe a cette adresse (meme discipline que resolveShareLink).
  if (!entity || !entity.is_public) return null;

  const [rows, relationRows, portraitLayout] = await Promise.all([
    listBlocksForEntity(supabase, entity.id),
    listRelationsForEntity(supabase, entity.id),
    getPortraitLayout(supabase, entity.id),
  ]);
  const visible = filterBlocks(rows.map(toVisibilityAware), { kind: "anonymous" });
  const blocks: PublicBlock[] = visible
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      // Un bloc `text` peut lui-meme etre public tout en contenant un
      // segment gm (SCHEMA.md §7.1, exemple Bram) : la visibilite du bloc
      // ne suffit pas, chaque segment est filtre a son tour avant de
      // jamais quitter le serveur. Meme principe pour les entrees d'un
      // bloc `timeline` (V2-H2).
      data: filterTimelineEntries(row.block_type, filterTextBlockSegments(row.block_type, row.data)),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Le bloc de fond n'est cherche que parmi les blocs DEJA filtres par
  // visibilite (`blocks`, ci-dessus) : un bloc reserve au MJ ne peut donc
  // jamais imposer un fond a un visiteur qui ne le voit pas.
  const backgroundBlock = blocks.find(
    (b) => b.blockType === "image" && (b.data as unknown as ImageBlockData).useAsWikiBackground
  );
  let wikiBackground: WikiBackground | null = null;
  if (backgroundBlock) {
    const meta = await getBackgroundMetaForBlock(supabase, backgroundBlock.id);
    if (meta) {
      const data = backgroundBlock.data as unknown as ImageBlockData;
      wikiBackground = {
        imageUrl: data.url,
        blurPx: data.backgroundBlurPx,
        fadeMs: data.fadeMs,
        hue: meta.hue,
        chroma: meta.chroma,
        mode: meta.availableModes[0] ?? "dark",
      };
    }
  }

  // Genealogie (V2-H3) : meme calcul que l'editeur (getFamilyTree,
  // src/server/services/genealogy.ts), juste avec un viewer anonyme — un
  // lien cache disparait de l'arbre avant meme d'atteindre cette reponse.
  const blocksWithGenealogy = await Promise.all(
    blocks.map(async (block) => {
      if (block.blockType !== "genealogy") return block;
      const genealogyData = zGenealogyBlockData.parse(block.data);
      const genealogyTree = await getFamilyTree(supabase, {
        worldId,
        rootEntityId: genealogyData.rootEntityId ?? entity.id,
        depthUp: genealogyData.depthUp,
        depthDown: genealogyData.depthDown,
        viewer: { kind: "anonymous" },
      });
      return { ...block, genealogyTree };
    })
  );

  // "Juste la partie schema" (V2-H2, retour utilisateur) pour le radar —
  // `personality`/`worldview` n'ont besoin de rien de plus pour LUI, leurs
  // poles sont deja dans la donnee du bloc, deja filtree par visibilite.
  // `relationship` et `relations_graph` ont besoin d'une resolution
  // supplementaire. V2 (retour utilisateur point 5) etend la portee : les
  // trois blocs recoivent aussi leurs souvenirs marques `is_public`, pour
  // le tableau optionnel sous le radar (`onlyPublic: true` partout —
  // jamais un souvenir MJ qui fuit parce que le bloc lui-meme est public).
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
      const [{ axes }, targetEntity, relationshipEvents] = await Promise.all([
        getCurrentAttitude(supabase, entity.id, relationshipData.target.id),
        getEntityById(supabase, relationshipData.target.id),
        getAttitudeEvents(supabase, entity.id, relationshipData.target.id, true),
      ]);
      // Fiche masquee (V2, retour utilisateur point 2) : meme motif que
      // `toPublicRelations`, jamais le nom d'une cible cachee dans la
      // legende du radar public.
      return {
        ...block,
        relationshipAxes: axes,
        relationshipTarget: targetEntity?.is_public ? { name: targetEntity.name, slug: targetEntity.slug } : null,
        relationshipEvents,
      };
    })
  );

  // Reseau (V2-H1 phase 5) : meme fonction que l'editeur (getRelationsGraph,
  // deja concue pour un viewer anonyme, voir son commentaire) — un lien
  // cache disparait du graphe avant meme d'atteindre cette reponse. Pas de
  // coloration par attitude ici (contrairement a l'editeur) : demanderait de
  // resoudre une campagne pour un simple embellissement visuel, non demande
  // au-dela de "voir le schema" — tous les liens restent neutres.
  const blocksWithRelationsGraph = await Promise.all(
    blocksWithRelationshipAxes.map(async (block) => {
      if (block.blockType !== "relations_graph") return block;
      const graphData = zRelationsGraphBlockData.parse(block.data);
      const relationsGraph = await getRelationsGraph(supabase, {
        worldId,
        rootEntityId: graphData.rootEntityId ?? entity.id,
        maxDegree: graphData.degreesVisible,
        viewer: { kind: "anonymous" },
      });
      return { ...block, relationsGraph };
    })
  );

  // Chronologie (V2-H2) : le calendrier du monde n'est jamais dans la
  // donnee du bloc, une seule lecture pour tous les blocs `timeline` de
  // cette fiche (comme `entityLookup` plus bas pour les quetes). V2 (retour
  // utilisateur point 5) etend le besoin : le tableau de souvenirs public
  // formate lui aussi une date ingame, meme calendrier, meme lecture unique.
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
    (block.blockType === "timeline" ||
      block.blockType === "personality" ||
      block.blockType === "worldview" ||
      block.blockType === "relationship")
      ? { ...block, timelineCalendar }
      : block
  );

  // Quete (V2-H4) : resout les id d'entite references (commanditaire,
  // objectifs, recompenses, prerequis) en nom/slug — la donnee du bloc ne
  // stocke que des id, insuffisant pour un lien cote wiki public. Filtre
  // par `is_public` (V2, retour utilisateur point 2) : une reference vers
  // une fiche masquee reste donc irresolvable ici, meme motif que
  // `toPublicRelations` — jamais de nom ni de lien mort qui la revele.
  const hasQuestBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "quest");
  const hasTimelineBlockRefs = blocksWithTimelineCalendar.some((b) => b.blockType === "timeline");
  const entityLookup =
    hasQuestBlock || hasTimelineBlockRefs
      ? new Map(
          (await listEntitiesForWorld(supabase, worldId))
            .filter((e) => e.is_public)
            .map((e) => [e.id, { name: e.name, slug: e.slug }])
        )
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

  // Carte (Lot I, phases C et F₁) : un bloc "own" resout ses propres
  // punaises (block.id) ; un bloc "ref" ne stocke qu'un `sourceBlockId`,
  // jamais assez pour afficher image ET punaises — `resolveMapSource`
  // revalide la visibilite du bloc SOURCE pour ce viewer anonyme avant de
  // renvoyer quoi que ce soit, meme si le bloc "ref" lui-meme est deja
  // public (ADR 0017 decision 1 : les punaises appartiennent au bloc
  // proprietaire, jamais copiees).
  const blocksWithMapSource = await Promise.all(
    blocksWithQuestRefs.map(async (block) => {
      if (block.blockType !== "map") return block;
      const map = zMapBlockData.safeParse(block.data);
      if (!map.success) return block;
      if (map.data.mode === "own") {
        const mapPins = await listVisibleMapPins(supabase, block.id, { kind: "anonymous" });
        return { ...block, mapPins };
      }
      const mapSource = await resolveMapSource(supabase, map.data.sourceBlockId, { kind: "anonymous" });
      const mapPins = mapSource ? await listVisibleMapPins(supabase, map.data.sourceBlockId, { kind: "anonymous" }) : [];
      return { ...block, mapSource, mapPins };
    })
  );

  return { entity, blocks: blocksWithMapSource, relations: toPublicRelations(relationRows), portraitLayout, wikiBackground };
}

/**
 * Octets d'une image de bloc pour un visiteur anonyme (V2-G12) : contrairement
 * au portrait (public des qu'on voit le nom de la fiche), un bloc a sa
 * propre visibilite (peut etre `gm`) — jamais servi sans reappliquer le
 * meme `filterBlocks` que pour le reste du contenu du bloc. `null` aussi
 * bien si le bloc n'existe pas que s'il n'est pas visible : jamais de
 * distinction qui revelerait l'existence d'un bloc cache.
 */
export async function getPublicBlockImage(blockId: string): Promise<BlockImage | null> {
  const supabase = createShareLinkServiceClient();
  const block = await getBlockById(supabase, blockId);
  if (!block) return null;

  const visible = filterBlocks([toVisibilityAware(block)], { kind: "anonymous" });
  if (visible.length === 0) return null;

  return getBlockImage(supabase, blockId);
}
