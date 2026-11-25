import "server-only";
import { listBlocksByTypeForEntities, listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { pronounGuidance, zPronouns } from "@/src/core/rules/pronouns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { buildTurnContext, type TurnContextInput, type TurnContextNpc, type TurnContextPlayer, type TurnContextQuest } from "@/src/core/ai/turnContext";
import { npcAddressedBy } from "@/src/core/ai/npcAddressed";
import { buildGmQuestionContext } from "@/src/core/ai/gmQuestionContext";
import { relationshipAxisLabel } from "@/src/core/psyche/bands";
import { zRelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
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
import { filterSegments } from "@/src/core/visibility";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { premierParagraphe } from "@/src/core/entities/premierePhrase";
import { estQuestionDirecte } from "@/src/core/ai/npcAddressed";
import { undoneEventIds } from "@/src/core/rules/turnUndo";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";

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

async function resolvePresentNpcs(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; playerEntityId: string; present: { entityId: string; zone: TurnContextNpc["zone"] }[] }
): Promise<TurnContextNpc[]> {
  const others = params.present.filter((p) => p.entityId !== params.playerEntityId);
  if (others.length === 0) return [];

  // V3.1-193 : les blocs `character` des présents, en UNE requête avec le reste (client du joueur : la RLS ne rend que ce qu'il peut voir).
  const [entities, knownAs, characterBlocks] = await Promise.all([
    listEntitiesByIds(supabase, others.map((p) => p.entityId)),
    knownAsByTarget(supabase, params.playerEntityId),
    listBlocksByTypeForEntities(
      supabase,
      others.map((p) => p.entityId),
      "character"
    ),
  ]);
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
    });
  }
  return npcs;
}

/**
 * V3-C2 — Les esquisses de la scène (`SceneState.sketches`) rejoignent les
 * PNJ réels dans le MÊME `npcIds` fermé : un identifiant local, jamais une
 * ligne `entities`, donc aucun aller-retour à `getCurrentAttitude`/
 * `knownAsByTarget` (les deux supposent une vraie entité). Le modèle peut
 * ainsi la faire parler (`npc_reaction`) sans jamais inventer son nom — le
 * générateur l'a déjà tiré (`sceneSketches.ts`).
 */
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

/** Combien d'actions passées du joueur la narration reçoit : assez pour suivre le fil d'une scène, peu pour ne pas noyer le tour présent. */
export const RECENT_PLAYER_ACTIONS_KEPT = 3;

/**
 * Les dernières narrations (plus récente en tête, comme avant) et les
 * dernières actions du joueur AVANT ce tour (plus ancienne en tête), en une
 * seule lecture de plus que l'existant : les deux sortes viennent de la même
 * requête, les annulations (V3-F2) de la seconde. Le tour en cours est déjà
 * journalisé quand la narration part : `fromEventId` l'écarte, et tout ce
 * qui le suit.
 */
async function resolveRecentHistory(
  supabase: TypedClient,
  sessionId: string,
  fromEventId: string | null
): Promise<{ narrations: string[]; playerActions: string[] }> {
  const [events, annulations] = await Promise.all([
    listRecentEventsByKinds(supabase, sessionId, ["narration", "player_action", "roll"], RECENT_NARRATIONS_KEPT * 3 + RECENT_PLAYER_ACTIONS_KEPT * 3),
    listRecentEventsByKind(supabase, sessionId, "system", 50),
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
  return { narrations, playerActions };
}

/**
 * Le premier paragraphe visible de la page du lieu : ses blocs `text`,
 * filtrés pour CE viewer (règle 5), puis leurs segments. Une lecture de plus
 * par tour narré.
 */
async function resolveLocationDescription(supabase: TypedClient, locationId: string, viewer: Viewer): Promise<string | null> {
  const blocs = filtrerBlocsVisibles(await listBlocksByTypesForEntities(supabase, [locationId], ["text"]), viewer).sort((a, b) => a.display_order - b.display_order);
  for (const bloc of blocs) {
    const parsed = zTextBlockData.safeParse(bloc.data);
    if (!parsed.success) continue;
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    const paragraphe = premierParagraphe(filterSegments(aware, viewer));
    if (paragraphe) return paragraphe;
  }
  return null;
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
  /** Vrai si le joueur pose une question : `narrateSoloTurn` n'exige la réplique du PNJ désigné (et ne réessaie) que dans ce cas. */
  addressedIsQuestion: boolean;
  /** Les présents tels que le modèle les a vus (nom déjà résolu par `known_as`, bande d'attitude) : la réplique retenue garde le nom et l'attitude de son PNJ pour le fil. */
  npcs: TurnContextNpc[];
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

  const [locationEntity, realNpcs, quests, history, player, money, locationDescription] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, present: scene.present })
      : Promise.resolve([]),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentHistory(supabase, params.sessionId, params.fromEventId ?? null),
    resolvePlayer(supabase, params.playerEntityId),
    resolveMoney(supabase, { playerEntityId: params.playerEntityId, scene }),
    scene ? resolveLocationDescription(supabase, scene.locationId, params.viewer) : Promise.resolve(null),
  ]);
  const recentNarrations = history.narrations;
  const npcs = [...realNpcs, ...sketchesAsNpcs(scene?.sketches ?? [])];
  const addressedNpcId = npcAddressedBy(params.playerAction, npcs);
  const addressedIsQuestion = estQuestionDirecte(params.playerAction);

  const input: TurnContextInput = {
    locationName: locationEntity?.name ?? "Hors scène",
    player,
    addressedNpcId,
    time: scene?.time ?? { day: 1, hour: 8, minute: 0 },
    lighting: scene?.lighting ?? "bright",
    npcs,
    quests,
    facts: params.facts,
    changes: params.changes,
    hints: params.hints,
    playerAction: params.playerAction,
    recentNarrations,
    ...money,
    locationDescription,
    weather: scene?.weather ?? null,
    recentPlayerActions: history.playerActions,
    addressedIsQuestion,
  };

  const knownEntityIds = [...(locationEntity ? [locationEntity.id] : []), ...realNpcs.map((n) => n.id)];
  return { text: buildTurnContext(input), npcIds: npcs.map((n) => n.id), knownEntityIds, recentNarrations, addressedNpcId, addressedIsQuestion, npcs };
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

  const [locationEntity, realNpcs, quests, recentNarrations] = await Promise.all([
    scene ? listEntitiesByIds(supabase, [scene.locationId]).then((rows) => rows[0] ?? null) : Promise.resolve(null),
    scene
      ? resolvePresentNpcs(supabase, { worldId: params.worldId, campaignId: params.campaignId, playerEntityId: params.playerEntityId, present: scene.present })
      : Promise.resolve([]),
    resolveQuests(supabase, params.worldId, params.viewer),
    resolveRecentHistory(supabase, params.sessionId, null).then((h) => h.narrations),
  ]);
  const npcs = [...realNpcs, ...sketchesAsNpcs(scene?.sketches ?? [])];

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
