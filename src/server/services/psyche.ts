import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { zPersonalityBlockData, type PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import { applyDelta } from "@/src/core/psyche/apply";
import { getBlockById } from "@/src/server/repos/blocks";
import { insertPersonalityEvent, listPersonalityEvents, type PersonalityEventRow } from "@/src/server/repos/psyche";
import { updateBlockContent, type VisibleBlock } from "@/src/server/services/blocks";

type TypedClient = SupabaseClient<Database>;

/** Un delta brut au-dela de ce seuil exige une confirmation explicite (specs/psyche-pnj.md §4). */
const CONFIRMATION_THRESHOLD = 40;

export type AddPersonalityEventResult =
  | { ok: true; block: VisibleBlock; event: PersonalityEventRow }
  | { ok: false; reason: "not_found" | "not_a_personality" | "unknown_pole" | "needs_confirmation" | "conflict" };

/**
 * Ajoute un souvenir au bloc `personality` (V2-H1) : journalise dans
 * `personality_events` (ajout seul) ET applique chaque delta au pole
 * correspondant dans la donnee du bloc (`applyDelta`, amorti vers les
 * extremes) — les deux ecritures ou aucune, jamais l'une sans l'autre.
 * Meme chemin pour un curseur deplace a la main (`summary` auto-genere
 * alors) et pour un vrai souvenir raconte : une seule source de verite.
 */
export async function addPersonalityEvent(
  supabase: TypedClient,
  params: {
    blockId: string;
    expectedVersion: number;
    summary: string;
    deltas: Partial<Record<PersonalityPoleKey, number>>;
    occurredAtIngame: string | null;
    origin: "gm" | "ai" | "player" | "system";
    confirmed: boolean;
    actorUserId: string;
  }
): Promise<AddPersonalityEventResult> {
  const existing = await getBlockById(supabase, params.blockId);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.block_type !== "personality") return { ok: false, reason: "not_a_personality" };

  const deltaEntries = Object.entries(params.deltas) as [PersonalityPoleKey, number][];
  if (deltaEntries.some(([key]) => !PERSONALITY_POLE_KEYS.includes(key))) {
    return { ok: false, reason: "unknown_pole" };
  }
  const hasLargeDelta = deltaEntries.some(([, delta]) => Math.abs(delta) > CONFIRMATION_THRESHOLD);
  if (hasLargeDelta && !params.confirmed) return { ok: false, reason: "needs_confirmation" };

  const data = zPersonalityBlockData.parse(existing.data);
  const nextData: PersonalityBlockData = {
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

export async function getPersonalityEvents(supabase: TypedClient, entityId: string): Promise<PersonalityEventRow[]> {
  return listPersonalityEvents(supabase, entityId);
}
