import type { CalendarConfig } from "./types";

/**
 * Calendrier neutre tant que le MJ n'a rien regle : jamais presente comme
 * "le" calendrier officiel d'un monde — un point de depart a renommer.
 * Republicain francais (retour utilisateur) plutot que gregorien, pour un
 * point de depart depaysant pour un calendrier de jeu. Domaine public
 * (aboli en 1805, aucune licence, CLAUDE.md : aucun nom emprunte a un
 * calendrier de licence).
 */
const DEFAULT_MONTH_NAMES = [
  "Vendémiaire", "Brumaire", "Frimaire", "Nivôse", "Pluviôse", "Ventôse",
  "Germinal", "Floréal", "Prairial", "Messidor", "Thermidor", "Fructidor",
];
/** Décade : dix jours plutôt que sept. */
const DEFAULT_WEEKDAY_NAMES = ["Primidi", "Duodi", "Tridi", "Quartidi", "Quintidi", "Sextidi", "Septidi", "Octidi", "Nonidi", "Décadi"];

export const DEFAULT_CALENDAR: CalendarConfig = {
  months: DEFAULT_MONTH_NAMES.map((name) => ({ name, days: 30 })),
  weekdays: DEFAULT_WEEKDAY_NAMES.map((name) => ({ name })),
  eras: [],
  currentDate: null,
};
