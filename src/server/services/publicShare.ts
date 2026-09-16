import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { createShareLinkServiceClient } from "@/lib/supabase/service";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import { verifySharePassword } from "@/src/core/shareLinks/password";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { zNoteTreeBlockData } from "@/src/core/schemas/blocks/noteTree";
import { collectRefTargetIds } from "@/src/core/linker/refTargets";
import { relationLabel, type RelationType } from "@/src/core/relations/inverses";
import { RELATION_LABELS_FR } from "@/src/i18n/fr";
import { type BlockRow, getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";
import {
  resolveEntityRefExcerpts,
  resolveRuleRefPreviews,
  type EntityRefPreview,
  type RuleRefPreview,
} from "@/src/server/services/refPreview";
import type { Locale } from "@/src/i18n/request";
import { getBlockImageAssetId } from "@/src/server/repos/blockImages";
import { getSignedAssetUrl } from "@/src/server/services/storage";
import { getBackgroundMetaForBlock } from "@/src/server/services/blockImages";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import { type EntitySummary, getEntityById, getEntityBySlug, listEntitiesForWorld } from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld, listRelationsForEntity, type OtherEntityRef } from "@/src/server/repos/relations";
import { listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getWorldById, getWorldEntityKindOrder } from "@/src/server/repos/worlds";
import { getSessionJournalTreeGroup, getLatestSessionJournalSlug } from "@/src/server/services/sessionJournal";
import { getPortraitLayout } from "@/src/server/services/entityPortraits";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { zGenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import { getFamilyTree } from "@/src/server/services/genealogy";
import { zMapBlockData } from "@/src/core/schemas/blocks/map";
import { resolveMapSource, type MapSourceInfo } from "@/src/server/services/mapSource";
import { listVisibleMapPins, type VisibleMapPin } from "@/src/server/services/mapPins";
import { listVisibleMapRegions, type VisibleMapRegion } from "@/src/server/services/mapRegions";
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
async function resolveShareLinkUncached(token: string): Promise<ResolvedShareLink | null> {
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

/**
 * `React.cache()` (V2.1-19 volet B) — la garde par mot de passe est posee a
 * DEUX endroits sur `/partage` : le layout (avant de charger le sommaire) et
 * la page (avant de charger la fiche). Ce n'est pas une precaution
 * superflue : en rendu serveur React, layout et page s'executent
 * concurremment, et un layout qui ne rend pas ses `children` n'annule pas le
 * travail que la page a deja lance. La garde doit donc exister aux deux
 * endroits — et la memoisation est ce qui la rend gratuite : une seule
 * resolution reelle pour tout le rendu.
 *
 * Bornee au rendu courant, jamais partagee entre deux requetes ni entre deux
 * visiteurs.
 */
export const resolveShareLink = cache(resolveShareLinkUncached);

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
 *
 * D'ou l'appel a la variante NON memoisee (V2.1-19 volet B) : `cache()` sert
 * a ne pas relire deux fois la meme chose dans un rendu, exactement ce que
 * cette fonction refuse. Une action de mot de passe s'execute dans la meme
 * requete que le rendu qui suit ; passer par la version memoisee ferait lire
 * ici un compteur de tentatives fige par un appel anterieur.
 */
export async function verifyShareLinkPassword(token: string, password: string): Promise<SharePasswordResult> {
  const resolved = await resolveShareLinkUncached(token);
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
async function getPublicEntityTreeUncached(worldId: string): Promise<EntityTreeGroup[]> {
  const supabase = createShareLinkServiceClient();
  const [allEntities, partOfEdges, playerCharacterIds, kindOrder, journalGroup] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
    listPlayerCharacterEntityIds(supabase, worldId),
    getWorldEntityKindOrder(supabase, worldId),
    getSessionJournalTreeGroup(supabase, worldId, { publicOnly: true }),
  ]);
  // `session_journal` exclu du groupe alphabetique generique, meme motif
  // que `getEntityTree` (entities.ts) : son groupe epingle (ci-dessus) le
  // remplace, jamais un doublon.
  const entities = allEntities.filter((e) => e.is_public && e.entity_kind !== "session_journal");
  const tree = buildEntityTree(withPlayerCharacterKinds(entities, playerCharacterIds), partOfEdges, kindOrder);
  return journalGroup ? [journalGroup, ...tree] : tree;
}

/**
 * `React.cache()` (V2.1-19 volet B) — memoise au niveau de l'ARBRE et non
 * de ses dependances : sur ses cinq requetes, une seule
 * (`listEntitiesForWorld`) etait deja memoisee. Les quatre autres
 * repartaient donc pour de vrai a chaque appel, et la page d'accueil du
 * lien de partage demande l'arbre juste apres le layout — pour decider
 * d'une phrase, pas pour construire une coquille.
 *
 * Verifie avant d'ecrire cette ligne plutot que suppose : la premiere
 * redaction du commentaire de `page.tsx` affirmait que les depots sous-
 * jacents s'en chargeaient deja. C'etait faux pour quatre sur cinq.
 */
export const getPublicEntityTree = cache(getPublicEntityTreeUncached);

/** Slug de l'entree du Livre de sessions la plus recente, publique uniquement (retour utilisateur : la page d'accueil du wiki public s'ouvre dessus) — `null` tant qu'aucune entree publique n'existe. */
export async function getLatestPublicSessionJournalSlug(worldId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  return getLatestSessionJournalSlug(supabase, worldId, { publicOnly: true });
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
  /**
   * Blocs `text` seulement (V2.1-1, liens automatiques) : cibles des noeuds
   * `ref` de kind "entity", indexees par identifiant — meme motif que
   * `questRefs`/`timelineRefs`.
   *
   * V2.1-18 lot 2 : porte desormais de quoi peindre la carte d'apercu au
   * survol, sans aucun aller-retour depuis le navigateur. `kind` est le
   * `entity_kind` brut, jamais un libelle — la traduction vit dans
   * `ENTITY_KIND_LABELS` cote affichage. `excerpt` est `null` quand la
   * fiche n'a aucun paragraphe visible A CE VISITEUR : le lien reste un
   * lien (sa destination existe), la carte se resserre sur le nom.
   */
  textRefs?: Record<string, EntityRefPreview>;
  /**
   * Blocs `text` seulement (V2.1-18 lot 2) : cibles des noeuds `ref` de kind
   * "rule", indexees par cle.
   *
   * Le commentaire precedent affirmait ici qu'une ref de regle ne demandait
   * aucune resolution serveur — vrai tant que son rendu se bornait a un lien
   * construit depuis la cle. Il ne l'est plus : une carte montre un nom, un
   * type et une prose, dont rien n'est porte par le noeud.
   *
   * Une cle ABSENTE de cette table est la decision "sans prose, pas de
   * lien" (V2.1-18) : fiche introuvable, ou description vide/reduite a une
   * reference de page (`page_ref`, le cas d'un ruleset
   * `personal_reference`). L'affichage n'a alors rien a montrer et rend du
   * texte ordinaire.
   */
  ruleRefs?: Record<string, RuleRefPreview>;
  /** Blocs `map` en mode "ref" seulement (Lot I, phase F₁) : image resolue du bloc source pour CE viewer — jamais le `sourceBlockId` brut envoye tel quel, sa visibilite propre doit etre revalidee ici (`resolveMapSource`). `null` si le bloc source n'existe pas/n'est plus visible. */
  mapSource?: MapSourceInfo | null;
  /** Blocs `map` seulement, own ET ref (Lot I, phase C) : punaises deja filtrees par visibilite pour CE viewer (`listVisibleMapPins`) — un bloc "ref" recoit les punaises du bloc SOURCE (ADR 0017 decision 1, "modifier une punaise sur le bloc proprietaire la modifie partout"). */
  mapPins?: VisibleMapPin[];
  /** Blocs `map` seulement, own ET ref (Lot I, phase D) : memes regles que `mapPins`, pour les zones. */
  mapRegions?: VisibleMapRegion[];
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

/**
 * Meme motif que `filterTextBlockSegments`, pour le bloc `note_tree`
 * (V2.1-2) : chaque page de l'arbre porte ses propres segments, comme un
 * bloc `text`. En pratique inatteignable (l'entite qui le porte,
 * `entity_kind: "notes"`, est exclue de toute liste publique — voir
 * `listPublishableEntities` ci-dessous) : filtre quand meme ici, defense en
 * profondeur plutot que de faire reposer toute la garantie sur un seul
 * point d'exclusion, exactement l'avertissement porte par
 * `publicShare.blockCoverage.test.ts`.
 */
function filterNoteTreeSegments(blockType: string, data: Json): Json {
  if (blockType !== "note_tree") return data;
  const parsed = zNoteTreeBlockData.safeParse(data);
  if (!parsed.success) return data;
  const items = parsed.data.items.map((item) => {
    if (item.kind !== "page") return item;
    const aware = item.content.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    const content = filterSegments(aware, { kind: "anonymous" }).map(({ visibility, ...rest }) => ({
      ...rest,
      visibility: { level: visibility.level, scopeId: visibility.scopeId },
    }));
    return { ...item, content };
  });
  return { ...parsed.data, items } as unknown as Json;
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

/**
 * Les trois fonctions qui suivent existent pour une seule raison (V2.1-20
 * lot 2.1) : le `layout.tsx` et la `page.tsx` ont desormais besoin du MEME
 * fond, et doivent le payer une fois.
 *
 * Mesure du lot 0 : resoudre un fond coute trois vagues (fiche → blocs →
 * meta). Le layout en fait deja deux pour son sommaire ; lui en ajouter trois
 * en ferait le chemin critique sur une fiche ordinaire, qui n'en coute que
 * quatre. Les partager annule ce surcout — `cache()` memoise la promesse, donc
 * layout et page qui partent en parallele attendent le meme appel.
 *
 * Memoise ICI, au niveau du service, et jamais sur `listBlocksForEntity`
 * (`repos/blocks.ts`) : ce depot a dix appelants dans des chemins d'ECRITURE
 * (characterActions, characterCreator, generators, notebook, duplication
 * d'entite). `React.cache()` etant borne a la requete, une action serveur qui
 * insere un bloc puis relit la liste recevrait la version d'avant l'ecriture.
 * On s'installerait un bug pour en eviter un autre. Ces trois-ci ne sont
 * atteignables que depuis le chemin de LECTURE publique, ou rien n'ecrit.
 */
const getPublicEntityBySlug = cache(async function getPublicEntityBySlug(
  worldId: string,
  entitySlug: string
): Promise<EntitySummary | null> {
  const supabase = createShareLinkServiceClient();
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  // `null` aussi bien pour "n'existe pas" que pour "masquee" : la distinction
  // ne doit jamais remonter, et la faire ici evite que chaque appelant ait a
  // se souvenir de la faire.
  if (!entity || !entity.is_public) return null;
  return entity;
});

/** Les blocs d'une fiche publique, deja filtres par visibilite — bloc puis segment, jamais l'un sans l'autre. */
const getPublicVisibleBlocks = cache(async function getPublicVisibleBlocks(
  worldId: string,
  entitySlug: string
): Promise<PublicBlock[]> {
  const entity = await getPublicEntityBySlug(worldId, entitySlug);
  if (!entity) return [];

  const supabase = createShareLinkServiceClient();
  const rows = await listBlocksForEntity(supabase, entity.id);
  return filterBlocks(rows.map(toVisibilityAware), { kind: "anonymous" })
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      // Un bloc `text` peut lui-meme etre public tout en contenant un
      // segment gm (SCHEMA.md §7.1, exemple Bram) : la visibilite du bloc
      // ne suffit pas, chaque segment est filtre a son tour avant de
      // jamais quitter le serveur. Meme principe pour les entrees d'un
      // bloc `timeline` (V2-H2).
      data: filterTimelineEntries(row.block_type, filterNoteTreeSegments(row.block_type, filterTextBlockSegments(row.block_type, row.data))),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
});

/**
 * Le fond de page wiki d'une fiche, seul — sans le reste de la fiche.
 *
 * C'est ce que le `layout.tsx` appelle pour poser `--h`/`--c`/`data-mode` et la
 * div de fond DANS LE HTML, au lieu de les laisser apparaitre apres
 * l'hydratation (V2.1-20 lot 2.1). Il tire la fiche courante de l'en-tete pose
 * par le middleware — voir `lib/wikiPath.ts`.
 *
 * Le bloc de fond n'est cherche que parmi les blocs DEJA filtres par
 * visibilite : un bloc reserve au MJ ne peut donc jamais imposer un fond a un
 * visiteur qui ne le voit pas, et une fiche masquee n'en a pas du tout.
 */
export const getPublicWikiBackground = cache(async function getPublicWikiBackground(
  worldId: string,
  entitySlug: string
): Promise<WikiBackground | null> {
  const blocks = await getPublicVisibleBlocks(worldId, entitySlug);
  const backgroundBlock = blocks.find(
    (b) => b.blockType === "image" && (b.data as unknown as ImageBlockData).useAsWikiBackground
  );
  if (!backgroundBlock) return null;

  const meta = await getBackgroundMetaForBlock(createShareLinkServiceClient(), backgroundBlock.id);
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

export async function getPublicEntityDetail(
  worldId: string,
  entitySlug: string,
  /** V2.1-18 lot 2 : sert uniquement a choisir la traduction d'une fiche de REGLE citee (`resolveRuleRefPreviews`). Fourni par l'appelant, jamais lu ici par `getLocale()` — meme convention que `services/rules.ts`. */
  locale: Locale = "fr",
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
  // Fiche masquee (V2, retour utilisateur point 2) : meme reponse que
  // "n'existe pas", jamais de distinction qui revelerait qu'une fiche
  // cachee existe a cette adresse (meme discipline que resolveShareLink).
  const entity = await getPublicEntityBySlug(worldId, entitySlug);
  if (!entity) return null;

  const [blocks, relationRows, portraitLayout, campaignId, wikiBackground, calendrierDuMonde, entitesDuMonde] = await Promise.all([
    getPublicVisibleBlocks(worldId, entitySlug),
    listRelationsForEntity(supabase, entity.id),
    getPortraitLayout(supabase, entity.id),
    resolveCampaignId(supabase, worldId),
    // Memoise, et c'est tout l'interet (V2.1-20 lot 2.1) : le `layout.tsx` a
    // demande le meme fond pour rendre la coquille cote serveur, et
    // `cache()` memoise la PROMESSE — les deux attendent le meme appel, pas
    // deux appels identiques. Demande ici EN MEME TEMPS que le reste plutot
    // qu'apres la liste des blocs, comme avant : `getPublicVisibleBlocks`
    // etant memoise lui aussi, les deux chemins partagent la meme lecture.
    getPublicWikiBackground(worldId, entitySlug),
    // V2.1-20 lot 3 — ces deux-la ne dependent que de `worldId`, connu des la
    // premiere ligne de cette fonction. Elles etaient pourtant demandees
    // beaucoup plus bas, chacune derriere un `if`, donc chacune dans sa propre
    // vague : le releve du lot 0 les a chronometrees a 65 et 93 ms sur le
    // chemin critique d'une fiche qui en compte onze. Elles n'attendaient rien
    // — seulement leur tour dans l'ordre d'ecriture du fichier.
    //
    // Demandees inconditionnellement alors qu'elles ne servent qu'a certains
    // types de bloc : c'est le marche accepte. Une requete parfois inutile,
    // mais gratuite en temps puisqu'elle voyage avec les autres, contre deux
    // allers-retours garantis sur le chemin critique. `listEntitiesForWorld`
    // est en plus memoise (repos/entities.ts) : au chargement complet d'une
    // page, le layout l'a deja demandee et celle-ci ne coute rien du tout.
    //
    // Les gardes ne bougent pas : c'est toujours la presence des blocs
    // concernes qui decide si le resultat est UTILISE, plus bas. Aucune donnee
    // nouvelle ne part vers le client.
    getCalendar(supabase, worldId),
    listEntitiesForWorld(supabase, worldId),
  ]);

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
        getCurrentAttitude(supabase, entity.world_id, entity.id, relationshipData.target.id),
        getEntityById(supabase, relationshipData.target.id),
        getAttitudeEvents(supabase, entity.world_id, entity.id, relationshipData.target.id, true),
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
      (b.blockType === "relationship" && (b.relationshipEvents?.length ?? 0) > 0) ||
      b.blockType === "session_journal_meta"
  );
  // Deja resolu (V2.1-20 lot 3) : plus aucune attente ici, seulement le choix
  // de s'en servir ou non.
  const timelineCalendar = hasDateFormattingBlock ? calendrierDuMonde : null;
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

  // Quete (V2-H4) : resout les id d'entite references (commanditaire,
  // objectifs, recompenses, prerequis) en nom/slug — la donnee du bloc ne
  // stocke que des id, insuffisant pour un lien cote wiki public. Filtre
  // par `is_public` (V2, retour utilisateur point 2) : une reference vers
  // une fiche masquee reste donc irresolvable ici, meme motif que
  // `toPublicRelations` — jamais de nom ni de lien mort qui la revele.
  const hasQuestBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "quest");
  const hasTimelineBlockRefs = blocksWithTimelineCalendar.some((b) => b.blockType === "timeline");
  const hasTextBlock = blocksWithTimelineCalendar.some((b) => b.blockType === "text");
  const entityLookup =
    hasQuestBlock || hasTimelineBlockRefs || hasTextBlock
      ? new Map(
          // Deja resolue (V2.1-20 lot 3), comme le calendrier ci-dessus.
          entitesDuMonde
            .filter((e) => e.is_public)
            .map((e) => [e.id, { name: e.name, slug: e.slug, kind: e.entity_kind }])
        )
      : null;

  // V2.1-18 lot 2 — les cibles de TOUS les blocs `text` de la fiche sont
  // rassemblees ici, puis resolues en deux lots, avant la boucle de rendu.
  // Le faire bloc par bloc reviendrait a une requete par bloc, et une
  // entree de Livre de sessions en compte plusieurs.
  const referencedEntityIds = new Set<string>();
  const referencedRuleKeys = new Set<string>();
  if (hasTextBlock && entityLookup) {
    for (const block of blocksWithTimelineCalendar) {
      if (block.blockType !== "text") continue;
      const text = zTextBlockData.safeParse(block.data);
      if (!text.success) continue;
      const { entityIds, ruleKeys } = collectRefTargetIds(text.data.segments);
      // Une cible non resolvable (fiche masquee ou supprimee) n'est jamais
      // demandee : son lien se rendra brise, il n'a pas d'extrait a porter.
      for (const id of entityIds) if (entityLookup.has(id)) referencedEntityIds.add(id);
      for (const key of ruleKeys) referencedRuleKeys.add(key);
    }
  }
  const [entityExcerpts, ruleRefsByKey] = await Promise.all([
    resolveEntityRefExcerpts(supabase, [...referencedEntityIds], { kind: "anonymous" }),
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
      // Seulement les cles de CE bloc : deux blocs `text` d'une meme fiche
      // ne citent pas les memes regles, et transporter la table entiere sous
      // chacun la ferait grossir avec le nombre de blocs.
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

  // Carte (Lot I, phases C, D et F₁) : un bloc "own" resout ses propres
  // punaises/zones (block.id) ; un bloc "ref" ne stocke qu'un
  // `sourceBlockId`, jamais assez pour afficher image ET elements —
  // `resolveMapSource` revalide la visibilite du bloc SOURCE pour ce
  // viewer anonyme avant de renvoyer quoi que ce soit, meme si le bloc
  // "ref" lui-meme est deja public (ADR 0017 decision 1 : punaises/zones
  // appartiennent au bloc proprietaire, jamais copiees).
  const blocksWithMapSource = await Promise.all(
    blocksWithQuestRefs.map(async (block) => {
      if (block.blockType !== "map") return block;
      const map = zMapBlockData.safeParse(block.data);
      if (!map.success) return block;
      if (map.data.mode === "own") {
        const [mapPins, mapRegions] = await Promise.all([
          listVisibleMapPins(supabase, block.id, { kind: "anonymous" }),
          listVisibleMapRegions(supabase, block.id, { kind: "anonymous" }, campaignId),
        ]);
        return { ...block, mapPins, mapRegions };
      }
      const mapSource = await resolveMapSource(supabase, map.data.sourceBlockId, { kind: "anonymous" });
      const [mapPins, mapRegions] = mapSource
        ? await Promise.all([
            listVisibleMapPins(supabase, map.data.sourceBlockId, { kind: "anonymous" }),
            listVisibleMapRegions(supabase, map.data.sourceBlockId, { kind: "anonymous" }, campaignId),
          ])
        : [[], []];
      return { ...block, mapSource, mapPins, mapRegions };
    })
  );

  return { entity, blocks: blocksWithMapSource, relations: toPublicRelations(relationRows), portraitLayout, wikiBackground };
}

/**
 * Asset d'une image de bloc pour un visiteur anonyme (V2-G12, V2-L1) :
 * contrairement au portrait (public des qu'on voit le nom de la fiche), un
 * bloc a sa propre visibilite (peut etre `gm`) — jamais servi sans
 * reappliquer le meme `filterBlocks` que pour le reste du contenu du bloc.
 * `null` aussi bien si le bloc n'existe pas que s'il n'est pas visible :
 * jamais de distinction qui revelerait l'existence d'un bloc cache.
 */
export async function getPublicBlockImageAssetId(blockId: string): Promise<string | null> {
  const supabase = createShareLinkServiceClient();
  const block = await getBlockById(supabase, blockId);
  if (!block) return null;

  // La FICHE entiere peut etre masquee (V2, retour utilisateur point 2 :
  // `is_public` bascule la fiche entiere), et `filterBlocks` ne regarde que la
  // visibilite du BLOC — il ne peut pas voir cela. `getPublicEntityDetail`
  // pose deja ce test avant de rendre quoi que ce soit ; il manquait ici.
  //
  // Sans consequence tant que le middleware redirigeait cette route vers
  // /login (V2.1-20 lot 2) : personne ne pouvait l'atteindre. Maintenant
  // qu'elle est atteignable, l'image d'un bloc public pose sur une fiche
  // MASQUEE se servirait a qui connait l'identifiant du bloc. Ajoute ici avec
  // le correctif, jamais apres.
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity || !entity.is_public) return null;

  const visible = filterBlocks([toVisibilityAware(block)], { kind: "anonymous" });
  if (visible.length === 0) return null;

  return getBlockImageAssetId(supabase, blockId);
}

/**
 * Le meme, signe. Separe de la resolution ci-dessus pour une raison de test :
 * la DECISION de servir ou non se verifie sans qu'aucun fichier n'existe dans
 * le stockage, ce qui est exactement ce qu'un test de fuite doit pouvoir faire
 * (`publicShare.integration.test.ts`).
 */
export async function getPublicBlockImageSignedUrl(blockId: string): Promise<string | null> {
  const assetId = await getPublicBlockImageAssetId(blockId);
  if (!assetId) return null;

  // La SIGNATURE passe par le meme client service-role, et c'est le coeur du
  // correctif (V2.1-20 lot 2). La route resolvait bien l'id de l'asset ici,
  // puis signait avec le client de la REQUETE — anonyme sur `/partage`. Or la
  // RLS `assets_select` (migration 20260902110001) ne laisse l'anon lire une
  // ligne `assets` que si elle est `visibility_level = 'public'`, et une image
  // de bloc est televersee en `players` (blockImageUpload.ts). La lecture
  // echouait donc toujours, et la route repondait 404 a tout visiteur anonyme.
  //
  // Jamais vu jusqu'ici parce qu'un second defaut le cachait : le middleware
  // redirigeait cette route vers /login avant meme de l'atteindre. Les deux
  // sont tombes ensemble.
  //
  // Ce n'est pas un contournement de la visibilite : la garde de cette image
  // est la visibilite de la FICHE puis celle du BLOC, toutes deux revalidees
  // par `getPublicBlockImageAssetId` ci-dessus avec un viewer anonyme. Le
  // `visibility_level` de l'asset ne decrit pas qui a le droit de voir l'image
  // d'un bloc public — c'est le bloc qui le dit, comme partout ailleurs dans
  // ce fichier.
  return getSignedAssetUrl(createShareLinkServiceClient(), assetId);
}
