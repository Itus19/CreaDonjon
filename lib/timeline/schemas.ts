import { z } from "zod";
import { zGameDate } from "@/src/core/schemas/calendar";
import { TIMELINE_ENTRY_KINDS, TIMELINE_SCOPES } from "@/src/core/schemas/blocks/timeline";

/**
 * Entrées des actions de la Chronologie du monde (V3.1-96, ADR 0048) —
 * règle absolue 4 : tout passe par Zod. La visibilité reprend la règle du
 * bloc : `campaign` et `user` exigent une portée, les autres non.
 */
const zVisibility = z
  .object({
    level: z.enum(["public", "players", "gm", "campaign", "user", "private"]),
    scopeId: z.string().uuid().nullable(),
  })
  .refine((v) => (v.level === "campaign" || v.level === "user" ? v.scopeId !== null : v.scopeId === null), {
    message: "campaign/user nécessitent une portée ; les autres niveaux n'en veulent pas.",
  });

export const addTimelineEventSchema = z.object({
  worldSlug: z.string().min(1),
  target: z.discriminatedUnion("kind", [z.object({ kind: z.literal("world") }), z.object({ kind: z.literal("entity"), entityId: z.string().uuid() })]),
  event: z.object({
    date: zGameDate,
    kind: z.enum(TIMELINE_ENTRY_KINDS),
    title: z.string().trim().min(1).max(200),
    summary: z.string().max(4000).default(""),
    visibility: zVisibility,
    scope: z.enum(TIMELINE_SCOPES).optional(),
  }),
});

export const setTimelineEntryScopeSchema = z.object({
  worldSlug: z.string().min(1),
  blockId: z.string().uuid(),
  entryId: z.string().min(1).max(100),
  /** `null` : la portée revient au défaut du genre. */
  scope: z.enum(TIMELINE_SCOPES).nullable(),
  expectedVersion: z.number().int().nonnegative(),
});
