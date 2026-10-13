"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addTimelineEventSchema, setTimelineEntryScopeSchema } from "@/lib/timeline/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { addTimelineEvent, setTimelineEntryScope } from "@/src/server/services/timeline";

/**
 * Écritures de la Chronologie du monde (V3.1-96, ADR 0048). Entrée validée
 * par Zod ; les droits sont tranchés par le service (MJ pour la frise
 * générale, droit d'écriture sur la fiche sinon), jamais par l'appelant.
 */
export type TimelineActionResult = { ok: true } | { ok: false; error: string };

const ERRORS = {
  forbidden: "Vous ne pouvez pas modifier cette chronologie.",
  not_found: "Chronologie introuvable.",
  conflict: "Cette chronologie a été modifiée entre-temps. Rechargez avant de réessayer.",
} as const;

async function session(worldSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  return { supabase, user, world };
}

export async function addTimelineEventAction(input: unknown): Promise<TimelineActionResult> {
  const parsed = addTimelineEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  const ctx = await session(parsed.data.worldSlug);
  if (!ctx) return { ok: false, error: ERRORS.not_found };
  const result = await addTimelineEvent(ctx.supabase, {
    worldId: ctx.world.id,
    userId: ctx.user.id,
    target: parsed.data.target,
    event: parsed.data.event,
  });
  if (!result.ok) return { ok: false, error: ERRORS[result.reason] };
  revalidatePath(`/m/${parsed.data.worldSlug}/chronologie`);
  return { ok: true };
}

export async function setTimelineEntryScopeAction(input: unknown): Promise<TimelineActionResult> {
  const parsed = setTimelineEntryScopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  const ctx = await session(parsed.data.worldSlug);
  if (!ctx) return { ok: false, error: ERRORS.not_found };
  const result = await setTimelineEntryScope(ctx.supabase, {
    blockId: parsed.data.blockId,
    entryId: parsed.data.entryId,
    scope: parsed.data.scope,
    expectedVersion: parsed.data.expectedVersion,
    userId: ctx.user.id,
  });
  if (!result.ok) return { ok: false, error: ERRORS[result.reason] };
  revalidatePath(`/m/${parsed.data.worldSlug}/chronologie`);
  return { ok: true };
}
