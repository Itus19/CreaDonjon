import { DEFAULT_CALENDAR } from "./defaultCalendar";
import type { CalendarConfig } from "./types";

/**
 * Les modèles de calendrier (demande de l'auteur, 26 novembre 2026) : un
 * point de départ appliqué en un clic dans l'outil Calendrier, puis
 * modifiable comme le reste. Un modèle ne fixe que la forme de l'année
 * (mois, semaine, mois le plus froid) ; les ères et le jour actuel restent
 * ceux du monde.
 *
 * Domaine public seulement (CLAUDE.md : aucun nom emprunté à un calendrier
 * sous licence). Un modèle « D&D » viendra avec des noms maison : celui des
 * Royaumes oubliés n'est pas dans le SRD.
 */
export type CalendarShape = Pick<CalendarConfig, "months" | "weekdays" | "weekdayEpoch" | "coldestMonth">;

export const CALENDAR_PRESET_KEYS = ["gregorian", "republican"] as const;
export type CalendarPresetKey = (typeof CALENDAR_PRESET_KEYS)[number];

const GREGORIAN_MONTHS: [string, number][] = [
  ["Janvier", 31], ["Février", 28], ["Mars", 31], ["Avril", 30], ["Mai", 31], ["Juin", 30],
  ["Juillet", 31], ["Août", 31], ["Septembre", 30], ["Octobre", 31], ["Novembre", 30], ["Décembre", 31],
];

export const CALENDAR_PRESETS: Record<CalendarPresetKey, CalendarShape> = {
  // Sans année bissextile : le calendrier du monde n'en connaît pas.
  gregorian: {
    months: GREGORIAN_MONTHS.map(([name, days]) => ({ name, days })),
    weekdays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((name) => ({ name })),
    weekdayEpoch: 0,
    coldestMonth: 1,
  },
  republican: {
    months: DEFAULT_CALENDAR.months,
    weekdays: DEFAULT_CALENDAR.weekdays,
    weekdayEpoch: DEFAULT_CALENDAR.weekdayEpoch,
    coldestMonth: DEFAULT_CALENDAR.coldestMonth,
  },
};
