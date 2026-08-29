import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { GameDate } from "@/src/core/calendar/types";
import { zPersonalityBlockData, type PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import { zWorldviewBlockData, type WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import {
  PERSONALITY_POLE_KEYS,
  RELATIONSHIP_AXIS_KEYS,
  WORLDVIEW_POLE_KEYS,
  type PersonalityPoleKey,
  type RelationshipAxisKey,
  type WorldviewPoleKey,
} from "@/src/core/psyche/keys";
import { applyDelta } from "@/src/core/psyche/apply";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import {
  getAttitude,
  insertAttitudeEvent,
  insertPersonalityEvent,
  listAttitudeEvents,
  listPersonalityEvents,
  updateAttitudeEventVisibility,
  updatePersonalityEventVisibility,
  upsertAttitude,
  type AttitudeEventRow,
  type PersonalityEventRow,
} from "@/src/server/repos/psyche";
import { updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";

type TypedClient = SupabaseClient<Database>;

export type AddPoleEventResult =
  | { ok: true; block: VisibleBlock; event: PersonalityEventRow }
  | { ok: false; reason: "not_found" | "wrong_block_type" | "unknown_pole" | "conflict" };

/**
 * Ajoute un souvenir a un bloc de poles hors campagne (`personality` ou
 * `worldview`, V2-H1) : journalise dans `personality_events` (ajout seul,
 * partage entre les deux types — meme portee, meme forme) ET applique
 * chaque delta au pole correspondant (`applyDelta`) — les deux ecritures
 * ou aucune. Meme chemin pour un curseur deplace a la main (`summary`
 * auto-genere alors) et pour un vrai souvenir raconte.
 */
async function addPoleEvent<TData extends { poles: { key: string; value: number; note?: string }[] }>(
  supabase: TypedClient,
  params: {
    blockType: "personality" | "worldview";
    validKeys: readonly string[];
    parse: (data: unknown) => TData;
    blockId: string;
    expectedVersion: number;
    summary: string;
    deltas: Record<string, number>;
    occurredAtIngame: GameDate | null;
    origin: "gm" | "ai" | "player" | "system";
    actorUserId: string;
  }
): Promise<AddPoleEventResult> {
  const existing = await getBlockById(supabase, params.blockId);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.block_type !== params.blockType) return { ok: false, reason: "wrong_block_type" };

  const deltaEntries = Object.entries(params.deltas);
  if (deltaEntries.some(([key]) => !params.validKeys.includes(key))) {
    return { ok: false, reason: "unknown_pole" };
  }

  const data = params.parse(existing.data);
  const nextData: TData = {
    ...data,
    poles: data.poles.map((pole) => {
      const delta = params.deltas[pole.key];
      return delta === undefined ? pole : { ...pole, value: applyDelta(pole.value, delta) };
    }),
  };

  const result = await updateBlockContent(supabase, {
    id: params.blockId,
    expectedVersion: params.expectedVersion,
    display: existing.display,
    data: nextData,
    visibilityLevel: existing.visibility_level,
    visibilityScopeId: existing.visibility_scope_id,
    changedBy: params.actorUserId,
  });
  if (!result.ok) return { ok: false, reason: result.reason === "not_found" ? "not_found" : "conflict" };

  const event = await insertPersonalityEvent(supabase, {
    entityId: existing.entity_id,
    summary: params.summary,
    deltas: params.deltas as Json,
    origin: params.origin,
    sessionEventId: null,
    occurredAtIngame: params.occurredAtIngame,
  });

  return { ok: true, block: result.block, event };
}

export async function addPersonalityEvent(
  supabase: TypedClient,
  params: {
    blockId: string;
    expectedVersion: number;
    summary: string;
    deltas: Partial<Record<PersonalityPoleKey, number>>;
    occurredAtIngame: GameDate | null;
    origin: "gm" | "ai" | "player" | "system";
    actorUserId: string;
  }
): Promise<AddPoleEventResult> {
  return addPoleEvent<PersonalityBlockData>(supabase, {
    ...params,
    deltas: params.deltas as Record<string, number>,
    blockType: "personality",
    validKeys: PERSONALITY_POLE_KEYS,
    parse: (data) => zPersonalityBlockData.parse(data),
  });
}

export async function addWorldviewEvent(
  supabase: TypedClient,
  params: {
    blockId: string;
    expectedVersion: number;
    summary: string;
    deltas: Partial<Record<WorldviewPoleKey, number>>;
    occurredAtIngame: GameDate | null;
    origin: "gm" | "ai" | "player" | "system";
    actorUserId: string;
  }
): Promise<AddPoleEventResult> {
  return addPoleEvent<WorldviewBlockData>(supabase, {
    ...params,
    deltas: params.deltas as Record<string, number>,
    blockType: "worldview",
    validKeys: WORLDVIEW_POLE_KEYS,
    parse: (data) => zWorldviewBlockData.parse(data),
  });
}

/**
 * Le journal partage (`personality_events`) filtre par cles de poles a
 * l'affichage — le bloc `personality` ne montre que SES souvenirs,
 * `worldview` les siens, meme si les deux ecrivent dans la meme table
 * (meme entite, meme portee). `onlyPublic` (V2, retour utilisateur point
 * 5) : le filtre `is_public` s'applique AVANT le `slice(0, 20)`, jamais
 * apres — sinon un souvenir recent mais masque ferait perdre a tort un
 * souvenir plus ancien mais public, au-dela de la fenetre des 20.
 */
async function listPoleEvents(
  supabase: TypedClient,
  entityId: string,
  validKeys: readonly string[],
  onlyPublic: boolean
): Promise<PersonalityEventRow[]> {
  const events = await listPersonalityEvents(supabase, entityId, 50);
  return events
    .filter((event) => Object.keys(event.deltas as Record<string, number>).some((key) => validKeys.includes(key)))
    .filter((event) => !onlyPublic || event.is_public)
    .slice(0, 20);
}

export async function getPersonalityEvents(
  supabase: TypedClient,
  entityId: string,
  onlyPublic = false
): Promise<PersonalityEventRow[]> {
  return listPoleEvents(supabase, entityId, PERSONALITY_POLE_KEYS, onlyPublic);
}

export async function getWorldviewEvents(
  supabase: TypedClient,
  entityId: string,
  onlyPublic = false
): Promise<PersonalityEventRow[]> {
  return listPoleEvents(supabase, entityId, WORLDVIEW_POLE_KEYS, onlyPublic);
}

/** Bascule "afficher au wiki" d'un souvenir de personnalite/convictions (V2, retour utilisateur point 5). */
export async function setPersonalityEventVisibility(supabase: TypedClient, id: string, isPublic: boolean): Promise<void> {
  await updatePersonalityEventVisibility(supabase, id, isPublic);
}

export interface AttitudeAxes {
  axes: Partial<Record<RelationshipAxisKey, number>>;
  campaignId: string | null;
}

/**
 * L'attitude courante de `sourceEntityId` envers `targetEntityId` (V2-H1,
 * bloc `relationship`) — portee CAMPAGNE, contrairement a `personality`
 * (docs/adr/0013-tables-psyche-pnj.md). `campaignId: null` = monde sans
 * campagne active, `axes: {}` alors (jamais d'erreur, meme motif que
 * `entity_runtime_state` "hors partie").
 */
export async function getCurrentAttitude(
  supabase: TypedClient,
  sourceEntityId: string,
  targetEntityId: string
): Promise<AttitudeAxes> {
  const entity = await getEntityById(supabase, sourceEntityId);
  const campaignId = entity ? await resolveCampaignId(supabase, entity.world_id) : null;
  if (!campaignId) return { axes: {}, campaignId: null };

  const row = await getAttitude(supabase, { campaignId, sourceEntityId, targetEntityId });
  return { axes: (row?.axes as Partial<Record<RelationshipAxisKey, number>>) ?? {}, campaignId };
}

export type AddAttitudeEventResult =
  | { ok: true; axes: Partial<Record<RelationshipAxisKey, number>>; event: AttitudeEventRow }
  | { ok: false; reason: "no_campaign" | "unknown_axis" };

/**
 * Ajoute un souvenir a une relation (V2-H1) : journalise dans
 * `attitude_events` (ajout seul, par paire) ET met a jour le cache
 * `entity_attitudes` (`applyDelta` par axe touche) — meme discipline que
 * `addPersonalityEvent`, portee campagne au lieu de portee entite. Sans
 * campagne active, rien a journaliser (meme motif que
 * `getOrOpenSessionForCampaign` : une relation n'a de valeur courante que
 * dans le cadre d'une partie).
 */
export async function addAttitudeEvent(
  supabase: TypedClient,
  params: {
    sourceEntityId: string;
    targetEntityId: string;
    summary: string;
    deltas: Partial<Record<RelationshipAxisKey, number>>;
    occurredAtIngame: GameDate | null;
    origin: "gm" | "ai" | "player" | "system";
  }
): Promise<AddAttitudeEventResult> {
  const deltaEntries = Object.entries(params.deltas) as [RelationshipAxisKey, number][];
  if (deltaEntries.some(([key]) => !RELATIONSHIP_AXIS_KEYS.includes(key))) {
    return { ok: false, reason: "unknown_axis" };
  }

  const entity = await getEntityById(supabase, params.sourceEntityId);
  const campaignId = entity ? await resolveCampaignId(supabase, entity.world_id) : null;
  if (!campaignId) return { ok: false, reason: "no_campaign" };

  const existing = await getAttitude(supabase, { campaignId, sourceEntityId: params.sourceEntityId, targetEntityId: params.targetEntityId });
  const currentAxes = (existing?.axes as Partial<Record<RelationshipAxisKey, number>>) ?? {};
  const nextAxes: Partial<Record<RelationshipAxisKey, number>> = { ...currentAxes };
  for (const [key, delta] of deltaEntries) {
    nextAxes[key] = applyDelta(currentAxes[key] ?? 0, delta);
  }

  await upsertAttitude(supabase, {
    campaignId,
    sourceEntityId: params.sourceEntityId,
    targetEntityId: params.targetEntityId,
    axes: nextAxes as Json,
  });

  const event = await insertAttitudeEvent(supabase, {
    campaignId,
    sourceEntityId: params.sourceEntityId,
    targetEntityId: params.targetEntityId,
    summary: params.summary,
    deltas: params.deltas as Json,
    origin: params.origin,
    sessionEventId: null,
    occurredAtIngame: params.occurredAtIngame,
  });

  return { ok: true, axes: nextAxes, event };
}

/** `onlyPublic` (V2, retour utilisateur point 5) : meme raison que `listPoleEvents` — filtre AVANT de retenir les 20 dernieres, jamais apres. */
export async function getAttitudeEvents(
  supabase: TypedClient,
  sourceEntityId: string,
  targetEntityId: string,
  onlyPublic = false
): Promise<AttitudeEventRow[]> {
  const entity = await getEntityById(supabase, sourceEntityId);
  const campaignId = entity ? await resolveCampaignId(supabase, entity.world_id) : null;
  if (!campaignId) return [];
  const events = await listAttitudeEvents(supabase, { campaignId, sourceEntityId, targetEntityId }, 50);
  return events.filter((event) => !onlyPublic || event.is_public).slice(0, 20);
}

/** Bascule "afficher au wiki" d'un souvenir de relation (V2, retour utilisateur point 5). */
export async function setAttitudeEventVisibility(supabase: TypedClient, id: string, isPublic: boolean): Promise<void> {
  await updateAttitudeEventVisibility(supabase, id, isPublic);
}
