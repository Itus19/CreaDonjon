/**
 * Calendrier d'un monde (V2-H2, specs/wiki-blocs.md §3) : un seul calendrier
 * par monde, stocke en JSON sur `worlds.calendar` (docs/SCHEMA.md §3,
 * colonne deja presente depuis la migration 002). `src/core/**` — aucune
 * dependance framework (CLAUDE.md regle 14).
 */

export type CalendarMonth = {
  name: string;
  days: number;
};

/** Une ere nommee commence a `startYear` (inclus) et dure jusqu'a la suivante (annees croissantes) — sert au regroupement `group_by: "era"` et a l'affichage en precision `era`. */
export type CalendarEra = {
  name: string;
  startYear: number;
};

export const DATE_PRECISIONS = ["day", "month", "season", "year", "decade", "era"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

/**
 * Une date de jeu (specs/wiki-blocs.md §3, "Les dates — le sujet piegeux").
 * `month`/`day` sont 1-indexes, absents des qu'ils depassent ce que la
 * `precision` represente (une precision "year" n'a pas de mois). `end`
 * permet une periode (une guerre dure) ; `label` prime a l'affichage quand
 * renseigne.
 */
export type GameDate = {
  year: number;
  month: number | null;
  day: number | null;
  precision: DatePrecision;
  end: { year: number; month: number | null; day: number | null } | null;
  label: string | null;
};

export type CalendarConfig = {
  months: CalendarMonth[];
  daysPerWeek: number;
  eras: CalendarEra[];
  /** Jour actuel de la campagne (retour utilisateur, V2-M13 : "renseigne automatiquement le jour ingame actuel") — `null` tant que le MJ ne l'a jamais regle. Un seul par monde, comme le reste du calendrier ("un monde = une campagne"). */
  currentDate: GameDate | null;
};
