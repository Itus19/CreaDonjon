import { z } from "zod";
import { DATE_PRECISIONS } from "@/src/core/calendar/types";

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

const zGameDatePart = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(24).nullable(),
  day: z.number().int().min(1).max(60).nullable(),
});

/**
 * Date de jeu structuree (V2-H2, specs/wiki-blocs.md §3 — meme forme que
 * `GameDate`, `src/core/calendar/types.ts`, dupliquee plutot qu'importee
 * pour le TYPE, CLAUDE.md regle 14). Partagee par le bloc `timeline` ET,
 * depuis la phase 3, les souvenirs `personality_events`/`attitude_events`
 * (V2-H1) — un seul schema de date structuree dans tout le depot.
 */
export const zGameDate = zGameDatePart.extend({
  precision: z.enum(DATE_PRECISIONS),
  end: zGameDatePart.nullable().default(null),
  label: z.string().trim().min(1).nullable().default(null),
});
export type GameDateInput = z.infer<typeof zGameDate>;
