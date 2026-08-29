import { z } from "zod";

/**
 * Validation du calendrier d'un monde (V2-H2, `worlds.calendar` jsonb —
 * colonne deja presente depuis la migration 002/`accounts.sql`). Un seul
 * calendrier par monde en V1 (specs/wiki-blocs.md §3) : pas de table dediee.
 */
export const zCalendarMonth = z.object({
  name: z.string().trim().min(1),
  days: z.number().int().min(1).max(60),
});

export const zCalendarEra = z.object({
  name: z.string().trim().min(1),
  startYear: z.number().int(),
});

export const zCalendarConfig = z.object({
  months: z.array(zCalendarMonth).min(1).max(24),
  daysPerWeek: z.number().int().min(1).max(30),
  eras: z.array(zCalendarEra).max(50).default([]),
});
export type CalendarConfigInput = z.infer<typeof zCalendarConfig>;
