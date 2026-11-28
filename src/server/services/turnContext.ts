import "server-only";
import { listTrueNamesForEntities } from "@/src/server/repos/entityTrueNames";
import { nouvellesNonDites, phraseDeNouvelle } from "@/src/core/rules/sceneLife";
import { listBlockVisibilityForEntities, listBlocksByTypeForEntities, listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { lieuxVoisins } from "@/src/core/rules/moveTargets";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import { pronounGuidance, zPronouns } from "@/src/core/rules/pronouns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { buildTurnContext, type TurnContextInput, type TurnContextNpc, type TurnContextPlayer, type TurnContextQuest } from "@/src/core/ai/turnContext";
import { npcAddressedBy } from "@/src/core/ai/npcAddressed";
import { buildGmQuestionContext } from "@/src/core/ai/gmQuestionContext";
import { relationshipAxisLabel } from "@/src/core/psyche/bands";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { esquissesAilleurs, esquissesIci, pieceCourante, presentsAilleurs, presentsIci } from "@/src/core/rules/scenePresence";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { zPriceListBlockData } from "@/src/core/schemas/blocks/priceList";
import { CURRENCY_ORDER, type Currency } from "@/src/core/rules/currency";
import { tabAt } from "@/src/core/rules/tab";
import type { SceneState } from "@/src/core/rules/scene";
import { CURRENCY_LABELS_FR, formatCpFr, formatTableEntryPrice } from "@/src/i18n/fr";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listRecentEventsByKind, listRecentEventsByKinds } from "@/src/server/repos/sessions";
import { filtrerBlocsVisibles } from "@/src/server/services/blocks";
import { filterSegments, genericPlayerViewer, isAdminViewer } from "@/src/core/visibility";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { premierParagraphe } from "@/src/core/entities/premierePhrase";
import { paragraphesDe, secretsEntre } from "@/src/core/ai/secretsMj";
import { zRoomsBlockData, type Room } from "@/src/core/schemas/blocks/rooms";
import { loadWeatherContext } from "@/src/server/services/sceneWeather";
import { weatherForScene } from "@/src/core/weather/sceneWeather";
import { describeWeatherForAi } from "@/src/core/ai/weatherText";
import { sceneDateLabel } from "@/src/server/services/soloScene";
import { estQuestionDirecte } from "@/src/core/ai/npcAddressed";
import { undoneEventIds } from "@/src/core/rules/turnUndo";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";
import { NPC_CHECK_SOURCE } from "@/src/server/services/npcChecks";
import { knowledgeSecrets } from "@/src/server/services/npcKnowledge";

/** V3-B4 — « les *n* dernières narrations » : même n que `RECENT_EVENTS_KEPT` (`src/core/rules/scene.ts`), pas de raison d'en choisir un autre. */
export const RECENT_NARRATIONS_KEPT = 5;

type TypedClient = SupabaseClient<Database>;

/**
 * V3-B3 — Résout les entrées côté base pour `buildTurnContext` (pur,
 * `src/core/ai/turnContext.ts`) : la scène courante, les présents avec
 * `known_as` appliqué et leur bande d'attitude nommée, les quêtes actives.
 *
 * **Toujours reconstruit, jamais mis en cache d'un tour à l'autre** — trou
 * n° 2 d'ADR 0009. Chaque appel relit `scene_states` : la boucle appelle
 * cette fonction après avoir écrit la scène du tour (`playTurn`), jamais
 * avant.
 *
 * **`viewer` vient TOUJOURS de l'appelant, jamais construit ici.** C'est ce
 * qui borne le contexte par l'audience (règle absolue 11) : cette fonction
 * ne peut pas s'élever elle-même à un viewer `gm`, elle transmet
 * simplement celui qu'on lui donne à `listActiveQuestsForWorld` — qui fait
 * déjà le filtrage réel (`filterBlocks`, éprouvé par
 * `visibilityRls.integration.test.ts`).
 */

/** L'axe "attitude générale" — le même mot que "cordial"/"hostile" déjà montré ailleurs dans l'écran solo (V3-D3). Les six autres axes (mefiance, respect...) restent hors de ce contexte : plus de nuance que ce dont une narration de deux phrases a besoin. */
const GENERAL_ATTITUDE_AXIS = "friendship_hostility" as const;

/** `relationship` blocks du PERSONNAGE JOUÉ, indexés par cible — c'est SA perception qui compte pour `known_as`, jamais celle du PNJ. */
async function knownAsByTarget(supabase: TypedClient, playerEntityId: string): Promise<Map<string, string>> {
  const blocks = await listBlocksForEntity(supabase, playerEntityId);
  const map = new Map<string, string>();
  for (const block of blocks) {
    if (block.block_type !== "relationship") continue;
    const parsed = zRelationshipBlockData.safeParse(block.data);
    if (!parsed.success || parsed.data.target?.kind !== "entity" || parsed.data.knownAs.trim() === "") continue;
    map.set(parsed.data.target.id, parsed.data.knownAs);
  }
  return map;
}

/** Au-delà, la description d'un PNJ est coupée : il en faut assez pour savoir qui il est, pas sa biographie. */
const NPC_DESCRIPTION_MAX = 240;

/**
 * Le premier paragraphe que CE viewer peut lire, par entité (premier bloc
 * `text` dans l'ordre d'affichage) : la même lecture que la description du
 * lieu (`resolveLocationPage`). Un secret de MJ n'y entre jamais (règle 11).
 */
function firstParagraphByEntity(blocks: Awaited<ReturnType<typeof listBlocksByTypesForEntities>>, viewer: Viewer): Map<string, string> {
  const out = new Map<string, string>();
  for (const bloc of filtrerBlocsVisibles(blocks, viewer).sort((a, b) => a.display_order - b.display_order)) {
    if (out.has(bloc.entity_id)) continue;
    const parsed = zTextBlockData.safeParse(bloc.data);
    if (!parsed.success) continue;
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    const paragraphe = premierParagraphe(filterSegments(aware, viewer));
    if (!paragraphe) continue;
    out.set(bloc.entity_id, paragraphe.length <= NPC_DESCRIPTION_MAX ? paragraphe : `${paragraphe.slice(0, NPC_DESCRIPTION_MAX - 1).trimEnd()}…`);
  }
  return out;
}

/** Tous les paragraphes que CE viewer peut lire, par entité, blocs `text` dans l'ordre d'affichage (ADR 0117). */
function paragraphsByEntity(blocks: Awaited<ReturnType<typeof listBlocksByTypesForEntities>>, viewer: Viewer): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const bloc of filtrerBlocsVisibles(blocks, viewer).sort((a, b) => a.display_order - b.display_order)) {
    const parsed = zTextBlockData.safeParse(bloc.data);
    if (!parsed.success) continue;
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    out.set(bloc.entity_id, [...(out.get(bloc.entity_id) ?? []), ...paragraphesDe(filterSegments(aware, viewer))]);
  }
  return out;
}

/**
 * ADR 0117 — deux lectures de la même page : ce que le personnage sait (le
 * lecteur « joueur » de la campagne : le propriétaire du monde qui joue en
 * solo verrait sinon tout comme s'il le savait) et ce que le MJ sait. Pour un
 * lecteur qui n'est pas MJ, les deux sont le même lecteur : aucun secret.
 */
export function lecteursDuTour(viewer: Viewer, campaignId: string): { joueur: Viewer; mj: Viewer } {
  return { joueur: isAdminViewer(viewer) ? genericPlayerViewer(campaignId) : viewer, mj: viewer };
}

/** Les secrets du MJ par entité : ce que `mj` lit et que `joueur` ne lit pas. */
function secretsByEntity(blocks: Awaited<ReturnType<typeof listBlocksByTypesForEntities>>, lecteurs: { joueur: Viewer; mj: Viewer }): Map<string, string> {
  const out = new Map<string, string>();
  if (lecteurs.joueur === lecteurs.mj) return out;
  const connus = paragraphsByEntity(blocks, lecteurs.joueur);
  for (const [entityId, complets] of paragraphsByEntity(blocks, lecteurs.mj)) {
    const secret = secretsEntre(complets, connus.get(entityId) ?? []);
    if (secret) out.set(entityId, secret);
  }
  return out;
}

/** V3.2-45 — le vrai nom d'un PNJ que le personnage ne connaît que par son libellé, en secret du MJ (ADR 0117). */
function vraiNomSecret(trueName: string): string {
  return `Son vrai nom est ${trueName}. Le personnage ne le connaît pas : ne l'écris pas, sauf si ce PNJ se présente ou qu'on le lui apprend.`;
}

async function resolvePresentNpcs(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; playerEntityId: string; viewer: Viewer; present: { entityId: string; zone: TurnContextNpc["zone"] }[] }
): Promise<{ npcs: TurnContextNpc[]; secrets: { name: string; text: string }[]; trueNames: { entityId: string; trueName: string }[] }> {
  const others = params.present.filter((p) => p.entityId !== params.playerEntityId);
  if (others.length === 0) return { npcs: [], secrets: [], trueNames: [] };
  const lecteurs = lecteursDuTour(params.viewer, params.campaignId);

  // V3.1-193 : les blocs `character` des présents, en UNE requête avec le reste (client du joueur : la RLS ne rend que ce qu'il peut voir).
  // 26 nov. : et leurs blocs `text`, pour dire au modèle qui ils sont (une lecture de plus, groupée).
  // V3.2-45 : les vrais noms tenus secrets (nom pour la table, ADR 0105), seulement pour le MJ du monde.
  const [entities, knownAs, characterBlocks, textBlocks, trueNames] = await Promise.all([
    listEntitiesByIds(supabase, others.map((p) => p.entityId)),
    knownAsByTarget(supabase, params.playerEntityId),
    listBlocksByTypeForEntities(
      supabase,
      others.map((p) => p.entityId),
      "character"
    ),
    listBlocksByTypesForEntities(
      supabase,
      others.map((p) => p.entityId),
      ["text"]
    ),
    lecteurs.joueur !== lecteurs.mj ? listTrueNamesForEntities(supabase, others.map((p) => p.entityId)) : Promise.resolve([]),
  ]);
  const descriptionById = firstParagraphByEntity(textBlocks, lecteurs.joueur);
  const secretById = secretsByEntity(textBlocks, lecteurs);
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  const pronounsById = new Map<string, string>();
  for (const b of characterBlocks) {
    const lu = zPronouns.safeParse((b.data as { pronouns?: unknown } | null)?.pronouns);
    const guidance = lu.success ? pronounGuidance(lu.data) : null;
    if (guidance) pronounsById.set(b.entity_id, guidance);
  }

  const npcs: TurnContextNpc[] = [];
  for (const p of others) {
    const { axes } = await getCurrentAttitude(supabase, params.worldId, p.entityId, params.playerEntityId);
    const value = axes[GENERAL_ATTITUDE_AXIS];
    npcs.push({
      id: p.entityId,
      name: knownAs.get(p.entityId) ?? nameById.get(p.entityId) ?? p.entityId,
      attitudeLabel: value === undefined ? null : relationshipAxisLabel(GENERAL_ATTITUDE_AXIS, value),
      zone: p.zone,
      ...(pronounsById.has(p.entityId) ? { pronouns: pronounsById.get(p.entityId) } : {}),
      ...(descriptionById.has(p.entityId) ? { description: descriptionById.get(p.entityId) } : {}),
    });
  }
  const trueNameById = new Map(trueNames.map((t) => [t.entityId, t.trueName]));
  const secrets = npcs.flatMap((n) => {
    const text = [secretById.get(n.id), trueNameById.has(n.id) ? vraiNomSecret(trueNameById.get(n.id)!) : undefined].filter((t): t is string => t !== undefined).join(" ");
    return text ? [{ name: n.name, text }] : [];
  });
  return { npcs, secrets, trueNames };
}

/**
 * V3-C2 — Les esquisses de la scène (`SceneState.sketches`) rejoignent les
 * PNJ réels dans le MÊME `npcIds` fermé : un identifiant local, jamais une
 * ligne `entities`, donc aucun aller-retour à `getCurrentAttitude`/
 * `knownAsByTarget` (les deux supposent une vraie entité). Le modèle peut
 * ainsi la faire parler (`npc_reaction`) sans jamais inventer son nom — le
 * générateur l'a déjà tiré (`sceneSketches.ts`).
 */
/**
 * V3.2-28 — Les présents du lieu qui sont dans une autre pièce, nommés comme
 * le joueur les connaît. Deux lectures (entités, `known_as`), seulement
 * quand quelqu'un est ailleurs : le cas courant (tout le monde ensemble) ne
 * coûte rien de plus.
 */
async function resolveElsewhere(
  supabase: TypedClient,
  params: { playerEntityId: string; scene: SceneState | null }
): Promise<{ name: string; room: string | null }[]> {
  if (!params.scene) return [];
  const reels = presentsAilleurs(params.scene).filter((p) => p.entityId !== params.playerEntityId);
  const esquisses = esquissesAilleurs(params.scene).map((s) => ({ name: s.name, room: s.room ?? null }));
  if (reels.length === 0) return esquisses;
  const [entities, knownAs] = await Promise.all([listEntitiesByIds(supabase, reels.map((p) => p.entityId)), knownAsByTarget(supabase, params.playerEntityId)]);
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  // Une entité que la RLS cache au joueur ne sort pas de son nom (règle 11) : on la tait.
  const nommes = reels.flatMap((p) => {
    const name = knownAs.get(p.entityId) ?? nameById.get(p.entityId);
    return name ? [{ name, room: p.room ?? null }] : [];
  });
  return [...nommes, ...esquisses];
}

/**
 * V3.2-31 — Les allées et venues que le personnage a vues depuis la dernière
 * narration (`sceneLife.ts`), en faits établis : l'IA les raconte, elle ne
 * les invente pas (§9). Une esquisse garde le libellé qu'elle avait ; une
 * entité est nommée comme le joueur la connaît, et tue si la RLS la cache
 * (règle 11). Une lecture de plus seulement quand une entité partie n'est
 * plus parmi les présents, ce qui reste rare.
 */
async function resolveLifeNews(
  supabase: TypedClient,
  params: { scene: SceneState; playerEntityId: string; npcs: TurnContextNpc[] }
): Promise<string[]> {
  const news = nouvellesNonDites(params.scene);
  if (news.length === 0) return [];
  const known = new Map(params.npcs.map((n) => [n.id, n.name]));
  const missing = news.filter((n) => n.name === null && !known.has(n.id)).map((n) => n.id);
  if (missing.length > 0) {
    const [entities, knownAs] = await Promise.all([listEntitiesByIds(supabase, missing), knownAsByTarget(supabase, params.playerEntityId)]);
    for (const e of entities) known.set(e.id, knownAs.get(e.id) ?? e.name);
  }
  return news.flatMap((n) => {
    const name = n.name ?? known.get(n.id);
    return name ? [phraseDeNouvelle(name, n.change)] : [];
  });
}

function sketchesAsNpcs(sketches: { id: string; name: string; trait: string; zone: TurnContextNpc["zone"] }[]): TurnContextNpc[] {
  return sketches.map((s) => ({ id: s.id, name: s.name, attitudeLabel: null, zone: s.zone, note: s.trait }));
}

/**
 * Le personnage joué, que la narration tutoie : son nom et ses pronoms.
 * Deux lectures de plus par tour narré (l'entité, son bloc `character`),
 * lancées en parallèle du reste du contexte.
 */
async function resolvePlayer(supabase: TypedClient, playerEntityId: string): Promise<TurnContextPlayer | null> {
  const [entities, characterBlocks] = await Promise.all([
    listEntitiesByIds(supabase, [playerEntityId]),
    listBlocksByTypeForEntities(supabase, [playerEntityId], "character"),
  ]);
  const entity = entities[0];
  if (!entity) return null;
  const lu = zPronouns.safeParse((characterBlocks[0]?.data as { pronouns?: unknown } | null)?.pronouns);
  const pronouns = lu.success ? pronounGuidance(lu.data) : null;
  return { name: entity.name, ...(pronouns ? { pronouns } : {}) };
}

async function resolveQuests(supabase: TypedClient, worldId: string, viewer: Viewer): Promise<TurnContextQuest[]> {
  const quests = await listActiveQuestsForWorld(supabase, worldId, viewer);
  return quests.map((q) => ({
    title: q.label,
    openObjectives: q.data.objectives.filter((o) => !o.done).map((o) => o.text),
  }));
}

/** Les derniers `rule_application` relus pour y trouver les jets de PNJ à raconter : un tour en écrit un ou deux. */
const NPC_OUTCOME_EVENTS_READ = 8;

/** Combien d'actions passées du joueur la narration reçoit : assez pour suivre le fil d'une scène, peu pour ne pas noyer le tour présent. */
export const RECENT_PLAYER_ACTIONS_KEPT = 3;

/**
 * Les dernières narrations (plus récente en tête, comme avant) et les
 * dernières actions du joueur AVANT ce tour (plus ancienne en tête), en une
 * seule lecture de plus que l'existant : les deux sortes viennent de la même
 * requête, les annulations (V3-F2) de la seconde. Le tour en cours est déjà
 * journalisé quand la narration part : `fromEventId` l'écarte, et tout ce
 * qui le suit. V3.2-52 : une troisième lecture, les derniers
 * `rule_application`, pour les issues des jets de PNJ (`npcOutcomes`).
 */
async function resolveRecentHistory(
  supabase: TypedClient,
  sessionId: string,
  fromEventId: string | null
): Promise<{ narrations: string[]; playerActions: string[]; npcOutcomes: string[] }> {
  const [events, annulations, regles] = await Promise.all([
    listRecentEventsByKinds(supabase, sessionId, ["narration", "player_action", "roll"], RECENT_NARRATIONS_KEPT * 3 + RECENT_PLAYER_ACTIONS_KEPT * 3),
    listRecentEventsByKind(supabase, sessionId, "system", 50),
    listRecentEventsByKind(supabase, sessionId, "rule_application", NPC_OUTCOME_EVENTS_READ),
  ]);
  const defaits = undoneEventIds(annulations.map((e) => ({ id: e.id, seq: e.seq, kind: e.kind, actor: e.actor, payload: (e.payload as Record<string, unknown> | null) ?? {} })));
  const vivants = events.filter((e) => !defaits.has(e.id));
  const narrations = vivants
    .filter((e) => e.kind === "narration")
    .slice(0, RECENT_NARRATIONS_KEPT)
    .map((e) => (e.payload as { text?: unknown } | null)?.text)
    .filter((text): text is string => typeof text === "string");
  const courant = fromEventId ? vivants.find((e) => e.id === fromEventId) : undefined;
  const playerActions = vivants
    .filter((e) => (e.kind === "player_action" || e.kind === "roll") && e.id !== fromEventId && (courant === undefined || e.seq < courant.seq))
    .slice(0, RECENT_PLAYER_ACTIONS_KEPT)
    .map((e) => (e.payload as { intent?: { text?: unknown } } | null)?.intent?.text)
    .filter((text): text is string => typeof text === "string" && text.trim() !== "")
    .reverse();
  // V3.2-52 — les jets de PNJ lancés depuis la dernière narration AVANT ce tour : la narration en raconte l'issue.
  const avant = (e: { seq: number }) => courant === undefined || e.seq < courant.seq;
  const derniereNarration = vivants.find((e) => e.kind === "narration" && avant(e));
  const npcOutcomes = regles
    .filter((e) => !defaits.has(e.id) && avant(e) && (derniereNarration === undefined || e.seq > derniereNarration.seq))
    .map((e) => e.payload as { source?: unknown; changes_text?: unknown } | null)
    .filter((p) => p?.source === NPC_CHECK_SOURCE && Array.isArray(p.changes_text))
    .flatMap((p) => (p!.changes_text as unknown[]).filter((t): t is string => typeof t === "string"))
    .reverse();
  return { narrations, playerActions, npcOutcomes };
}

/**
 * Le premier paragraphe visible de la page du lieu (ses blocs `text`,
 * filtrés pour CE viewer, règle 5, puis leurs segments) et ses pièces
 * visibles (blocs `rooms`, V3.2-19). Une seule lecture de plus par tour narré.
 */
async function resolveLocationPage(
  supabase: TypedClient,
  locationId: string,
  lecteurs: { joueur: Viewer; mj: Viewer }
): Promise<{ description: string | null; rooms: Room[]; secret: string | null }> {
  const lignes = await listBlocksByTypesForEntities(supabase, [locationId], ["text", "rooms"]);
  // ADR 0117 : la description et les pièces sont ce que le personnage sait ; le reste de la page, le secret du MJ.
  const viewer = lecteurs.joueur;
  const secret = secretsByEntity(lignes.filter((l) => l.block_type === "text"), lecteurs).get(locationId) ?? null;
  const blocs = filtrerBlocsVisibles(lignes, viewer).sort((a, b) => a.display_order - b.display_order);
  let description: string | null = null;
  const rooms: Room[] = [];
  for (const bloc of blocs) {
    if (bloc.block_type === "rooms") {
      const lu = zRoomsBlockData.safeParse(bloc.data);
      if (lu.success) rooms.push(...lu.data.rooms);
      continue;
    }
    if (description !== null) continue;
    const parsed = zTextBlockData.safeParse(bloc.data);
    if (!parsed.success) continue;
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    description = premierParagraphe(filterSegments(aware, viewer));
  }
  return { description, rooms, secret };
}

/**
 * V3.2-19 — Les lieux voisins (`lieuxVoisins`, relation `part_of`) que CE
 * viewer peut voir : un lieu compte s'il a au moins un bloc visible pour lui
 * (même règle que la liste du wiki, sans les cas du Livre de séance, qui ne
 * sont jamais des lieux). Trois lectures par tour narré : les arêtes, la
 * visibilité des blocs, les noms.
 */
async function resolveMoveTargets(supabase: TypedClient, worldId: string, locationId: string, viewer: Viewer): Promise<{ id: string; name: string }[]> {
  const voisins = lieuxVoisins(locationId, await listPartOfRelationsForWorld(supabase, worldId));
  if (voisins.length === 0) return [];
  const [rows, entities] = await Promise.all([listBlockVisibilityForEntities(supabase, voisins), listEntitiesByIds(supabase, voisins)]);
  const visibles = new Set(
    filterBlocks(
      rows.map((r) => ({ ...r, visibility: { level: r.visibility_level as VisibilityLevel, scopeId: r.visibility_scope_id, createdBy: r.created_by } })),
      viewer
    ).map((r) => r.entity_id)
  );
  return entities.filter((e) => e.entity_kind === "location" && visibles.has(e.id)).map((e) => ({ id: e.id, name: e.name }));
}

export interface SoloTurnContext {
  /** Le texte pret a poser en message `user`. */
  text: string;
  /** Les ids des PNJ presents (esquisses comprises) — jamais devine par l'appelant : c'est ce qui borne l'enum `npc_id` d'un outil de narration (meme garde-fou que le spike, generalise). */
  npcIds: string[];
  /** V3-C3 — le lieu et les PNJ REELS (jamais une esquisse, qui n'a pas de fiche) : ce qui borne l'enum `entity_id` de `world_note`, une suggestion redactionnelle jamais ecrite directement. */
  knownEntityIds: string[];
  /** V3-B4 — Rendues telles quelles (pas seulement injectees dans `text`) pour que l'appelant (`narrateSoloTurn`) puisse mesurer la similarite d'un essai SANS relire la session une seconde fois. */
  recentNarrations: string[];
  /** Le PNJ à qui le joueur parle, s'il est clairement désigné. */
  addressedNpcId: string | null;
  /** V3.2-19 — les ids des lieux accessibles : ce qui borne l'enum `location_id` de `move_to`. */
  moveTargetIds: string[];
  /** V3.2-19 — les mêmes avec leur nom : le contrôle d'une pièce inventée refuse le nom d'un lieu voisin. */
  moveTargets: { id: string; name: string }[];
  /** V3.2-19 — les pièces du bloc « Pièces » visibles du joueur, telles qu'écrites. */
  wikiRooms: Room[];
  /** V3.2-19 — le nom du lieu courant, pour le même contrôle. */
  locationName: string | null;
  /** V3.2-19 — vrai si l'on est dans une esquisse de pièce : le joueur qui la nomme la fait entrer dans le wiki. */
  inSketchRoom: boolean;
  /** V3.2-80 — le nom du personnage joué, pour les faits sur ce que les PNJ savent de lui. */
  playerName: string | null;
  /** Vrai si le joueur pose une question : `narrateSoloTurn` n'exige la réplique du PNJ désigné (et ne réessaie) que dans ce cas. */
  addressedIsQuestion: boolean;
  /** Les présents tels que le modèle les a vus (nom déjà résolu par `known_as`, bande d'attitude) : la réplique retenue garde le nom et l'attitude de son PNJ pour le fil. */
  npcs: TurnContextNpc[];
  /** V3.2-45 — les vrais noms secrets des présents : une narration qui en écrit un le révèle (`revelerNomsDits`). */
  trueNames: { entityId: string; trueName: string }[];
}

/** Au-delà, la carte est tronquée : le contexte d'un modèle local est compté. */
const MAX_PRICE_LIST_LINES = 40;

/** « 1 po, 12 pa, 3 pc » : les pièces telles qu'elles sont dans la bourse, sans les recomposer ; « vide » sinon. */
function purseText(currency: Currency | null): string {
  if (!currency) return "vide";
  const parts = CURRENCY_ORDER.filter((coin) => currency[coin] > 0).map((coin) => `${currency[coin]} ${CURRENCY_LABELS_FR[coin]}`);
  for (const [key, amount] of Object.entries(currency.extra ?? {})) if (amount > 0) parts.push(`${amount} ${key}`);
  return parts.length > 0 ? parts.join(", ") : "vide";
}

/**
 * V3.2-11 (ADR 0110) — ce que la personne a, ce qu'elle doit ici, et ce que le
 * lieu vend : la bourse (bloc `inventory` du personnage), la carte (bloc
 * `price_list` du lieu) et l'ardoise du lieu (dans la scène, déjà lue). Une
 * seule lecture de plus par tour narré, sous la RLS de la personne qui joue :
 * une carte qu'elle ne voit pas n'entre pas dans le contexte (règle 11).
 */
async function resolveMoney(
  supabase: TypedClient,
  params: { playerEntityId: string; scene: SceneState | null }
): Promise<Pick<TurnContextInput, "purse" | "priceList" | "tab">> {
  if (!params.scene) return {};
  const locationId = params.scene.locationId;
  const rows = await listBlocksByTypesForEntities(supabase, [params.playerEntityId, locationId], ["inventory", "price_list"]);
  const inventoryRow = rows.find((r) => r.entity_id === params.playerEntityId && r.block_type === "inventory");
  const priceListRow = rows.find((r) => r.entity_id === locationId && r.block_type === "price_list");
  const inventory = inventoryRow ? zInventoryBlockData.safeParse(inventoryRow.data) : null;
  const priceList = priceListRow ? zPriceListBlockData.safeParse(priceListRow.data) : null;
  if (inventory && !inventory.success) console.error("Inventaire illisible, bourse omise du contexte", params.playerEntityId, inventory.error.issues);
  if (priceList && !priceList.success) console.error("Carte du lieu illisible, omise du contexte", locationId, priceList.error.issues);

  return {
    purse: purseText(inventory?.success ? inventory.data.currency : null),
    priceList: priceList?.success
      ? priceList.data.offers.slice(0, MAX_PRICE_LIST_LINES).map((o) => `${o.label} : ${formatTableEntryPrice(o.price) ?? ""}`)
      : [],
    tab: tabAt(params.scene, locationId).map((line) => `« ${line.label} », ${formatCpFr(line.priceCp)}, ${line.creditor ? `due à ${line.creditor}` : "due au lieu"}`),
  };
}

export async function buildSoloTurnContext(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    playerEntityId: string;
    /** Le viewer du JOUEUR qui joue ce tour — jamais un viewer `gm`, c'est lui qui borne l'audience. */
    viewer: Viewer;
    /** V3-B4 — sert à relire les dernières narrations de CETTE session, pour la consigne de ne pas les répéter. */
    sessionId: string;
    playerAction: string;
    /** L'événement que ce tour raconte, déjà journalisé : écarté des « actions précédentes ». */
    fromEventId?: string;
    facts: string[];
    changes: string[];
    hints: string[];
  }
): Promise<SoloTurnContext> {
  const scene = await getSceneState(supabase, params.campaignId);

  // V3.2-28 : l'IA ne voit avec le personnage que ceux de sa pièce ; les autres, à part.
  const [locationEntity, presents, quests, history, player, money, locationPage, moveTargets, elsewhere, weatherCtx] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, viewer: params.viewer, present: presentsIci(scene) })
      : Promise.resolve({ npcs: [], secrets: [], trueNames: [] }),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentHistory(supabase, params.sessionId, params.fromEventId ?? null),
    resolvePlayer(supabase, params.playerEntityId),
    resolveMoney(supabase, { playerEntityId: params.playerEntityId, scene }),
    scene
      ? resolveLocationPage(supabase, scene.locationId, lecteursDuTour(params.viewer, params.campaignId))
      : Promise.resolve({ description: null, rooms: [] as Room[], secret: null }),
    scene ? resolveMoveTargets(supabase, params.worldId, scene.locationId, params.viewer) : Promise.resolve([]),
    resolveElsewhere(supabase, { playerEntityId: params.playerEntityId, scene }),
    // ME-5 : de quoi calculer la météo de la scène (calendrier, climat, pièces).
    scene ? loadWeatherContext(supabase, { worldId: params.worldId, locationId: scene.locationId }) : Promise.resolve(null),
  ]);
  const recentNarrations = history.narrations;
  const locationDescription = locationPage.description;
  // V3.2-19 : les pièces connues ici, celles du wiki puis les esquisses de la scène ; et celle où l'on est.
  const roomSketchesHere = (scene?.roomSketches ?? []).filter((r) => r.locationId === scene?.locationId);
  const knownRooms = [...locationPage.rooms.map((r) => ({ name: r.name, description: r.description })), ...roomSketchesHere.map((r) => ({ name: r.name, description: r.description }))];
  const currentRoom = scene?.room && scene.room.locationId === scene.locationId ? { name: scene.room.name, description: scene.room.description } : null;
  const realNpcs = presents.npcs;
  // ADR 0117 : ce que seul le MJ sait du lieu et des présents, à part. V3.2-80 : et ce que chaque présent sait du personnage.
  const savoirs = player ? await knowledgeSecrets(supabase, { campaignId: params.campaignId, pcEntityId: params.playerEntityId, pcName: player.name, npcs: presents.npcs.map((n) => ({ id: n.id, name: n.name })) }) : [];
  const secrets = [...(locationPage.secret && locationEntity ? [{ name: locationEntity.name, text: locationPage.secret }] : []), ...presents.secrets, ...savoirs];
  const npcs = [...realNpcs, ...sketchesAsNpcs(scene ? esquissesIci(scene) : [])];
  const addressedNpcId = npcAddressedBy(params.playerAction, npcs);
  const addressedIsQuestion = estQuestionDirecte(params.playerAction);
  const lifeFacts = scene ? await resolveLifeNews(supabase, { scene, playerEntityId: params.playerEntityId, npcs: realNpcs }) : [];

  const input: TurnContextInput = {
    locationName: locationEntity?.name ?? "Hors scène",
    player,
    addressedNpcId,
    time: scene?.time ?? { day: 1, hour: 8, minute: 0 },
    lighting: scene?.lighting ?? "bright",
    npcs,
    quests,
    facts: [...history.npcOutcomes, ...params.facts, ...lifeFacts],
    changes: params.changes,
    hints: params.hints,
    playerAction: params.playerAction,
    recentNarrations,
    ...money,
    locationDescription,
    // V3.2-59 : la date du monde, lue sur le calendrier déjà chargé pour la météo (aucune lecture de plus). La saison est dans la ligne météo.
    dateLabel: scene && weatherCtx ? sceneDateLabel(scene.time.day, weatherCtx.calendar) : null,
    weather: scene && weatherCtx ? describeWeatherForAi(weatherForScene(weatherCtx, scene.time, pieceCourante(scene))) : null,
    recentPlayerActions: history.playerActions,
    addressedIsQuestion,
    moveTargets,
    rooms: knownRooms,
    currentRoom,
    elsewhere,
    secrets,
  };

  const knownEntityIds = [...(locationEntity ? [locationEntity.id] : []), ...realNpcs.map((n) => n.id)];
  return { text: buildTurnContext(input), npcIds: npcs.map((n) => n.id), knownEntityIds, recentNarrations, addressedNpcId, addressedIsQuestion, npcs, trueNames: presents.trueNames, moveTargetIds: moveTargets.map((l) => l.id), moveTargets, wikiRooms: locationPage.rooms, locationName: locationEntity?.name ?? null, inSketchRoom: scene?.room?.anchored === false, playerName: player?.name ?? null };
}

/**
 * V3-D4 — Même résolution que `buildSoloTurnContext` (scène, PNJ présents,
 * quêtes, dernières narrations), mais pour une question posée HORS DU
 * TEMPS DE JEU (le bouton `MJ`) : pas de `playerAction`/`facts`/`changes`/
 * `hints`, rien n'a été résolu — voir `buildGmQuestionContext`
 * (`src/core/ai/`) pour ce qui distingue les deux compositions.
 */
export async function buildSoloGmQuestionContext(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    playerEntityId: string;
    /** Le viewer du JOUEUR qui pose la question — jamais un viewer `gm`. */
    viewer: Viewer;
    sessionId: string;
    question: string;
  }
): Promise<{ text: string }> {
  const scene = await getSceneState(supabase, params.campaignId);

  // La question hors du temps de jeu ne reçoit pas les secrets (ADR 0117 : seule la narration du tour les voit).
  const [locationEntity, presents, quests, recentNarrations] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, viewer: params.viewer, present: presentsIci(scene) })
      : Promise.resolve({ npcs: [], secrets: [], trueNames: [] }),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentHistory(supabase, params.sessionId, null).then((h) => h.narrations),
  ]);
  const npcs = [...presents.npcs, ...sketchesAsNpcs(scene ? esquissesIci(scene) : [])];

  return {
    text: buildGmQuestionContext({
      locationName: locationEntity?.name ?? "Hors scène",
      time: scene?.time ?? { day: 1, hour: 8, minute: 0 },
      lighting: scene?.lighting ?? "bright",
      npcs,
      quests,
      recentNarrations,
      question: params.question,
    }),
  };
}
