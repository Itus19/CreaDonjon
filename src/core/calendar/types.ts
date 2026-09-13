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

/** Un jour de la semaine nomme (V2.1-4, retour utilisateur : "renommer les jours de la semaine comme pour les mois") — le nombre de jours par semaine EST la longueur de ce tableau, remplace l'ancien `daysPerWeek` (un simple compte, jamais utilise pour un calcul reel). */
export type CalendarWeekday = {
  name: string;
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
  weekdays: CalendarWeekday[];
  eras: CalendarEra[];
  /** Jour actuel de la campagne (retour utilisateur, V2-M13 : "renseigne automatiquement le jour ingame actuel") — `null` tant que le MJ ne l'a jamais regle. Un seul par monde, comme le reste du calendrier ("un monde = une campagne"). */
  currentDate: GameDate | null;
  /** Indice (dans `weekdays`) du jour de la semaine du 1er jour du 1er mois de l'an 0 (retour utilisateur, V2.1-3 suite) — point de reference qui permet de calculer le jour de la semaine de N'IMPORTE QUELLE date, plutot que de le saisir a la main pour chaque date. Reglable (pas fige a "Primidi") : un monde qui renomme ses jours de semaine peut vouloir un decalage different. Defaut 0 (le premier jour de `weekdays`). */
  weekdayEpoch: number;
};
