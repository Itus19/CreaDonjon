import { clampDayToCalendar, shiftDate, type DayDate } from "@/src/core/calendar/navigation";
import type { GameDate } from "@/src/core/calendar/types";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Edition locale du calendrier ingame (V3.1-55) : un reducteur pur
 * `(calendrier, action) -> calendrier`. Le composant ne fait que lui envoyer
 * des actions ; rien n'est ecrit avant « Enregistrer ». Les bornes sont celles
 * du schema Zod (`src/core/schemas/calendar.ts`) : l'ecran ne peut pas produire
 * un calendrier que la route refuserait, hors noms vides (`calendrierValide`).
 */

export const MOIS_MAX = 24;
export const JOURS_PAR_MOIS_MAX = 60;
export const SEMAINE_MAX = 30;
export const ERES_MAX = 50;

export type ActionCalendrier =
  | { type: "moisRenommer"; index: number; nom: string }
  | { type: "moisDuree"; index: number; jours: number }
  | { type: "moisDeplacer"; index: number; sens: -1 | 1 }
  | { type: "moisAjouterApres"; index: number; nom: string }
  | { type: "moisSupprimer"; index: number }
  | { type: "semaineRenommer"; index: number; nom: string }
  | { type: "semaineDecaler"; index: number }
  | { type: "semaineSupprimer"; index: number }
  | { type: "semaineAjouter"; nom: string }
  | { type: "epoque"; index: number }
  | { type: "ereAjouter"; nom: string }
  | { type: "ereRenommer"; index: number; nom: string }
  | { type: "ereDebut"; index: number; annee: number }
  | { type: "ereSupprimer"; index: number }
  | { type: "jourDecaler"; n: number }
  | { type: "jourRegler"; date: DayDate }
  | { type: "jourInitialiser" };

/** Point de depart du « jour actuel » : an 0, 1er jour du 1er mois, jamais suppose. */
export function jourActuelVierge(): GameDate {
  return { year: 0, month: 1, day: 1, precision: "day", end: null, label: null };
}

function borne(n: number, min: number, max: number): number {
  const entier = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, entier));
}

/** Echange deux elements voisins ; renvoie la liste inchangee si l'un des rangs n'existe pas. */
function echanger<T>(liste: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= liste.length || b >= liste.length) return liste;
  const copie = [...liste];
  [copie[a], copie[b]] = [copie[b], copie[a]];
  return copie;
}

/** Apres toute modification, le jour actuel reste un jour qui existe (mois supprime, mois raccourci). */
function recaler(calendrier: CalendarConfigInput): CalendarConfigInput {
  const courant = calendrier.currentDate;
  if (!courant || courant.month === null || courant.day === null) return calendrier;
  const date = clampDayToCalendar({ year: courant.year, month: courant.month, day: courant.day }, calendrier);
  if (date.month === courant.month && date.day === courant.day) return calendrier;
  return { ...calendrier, currentDate: { ...courant, month: date.month, day: date.day } };
}

/**
 * Le mois du jour actuel quand les mois changent de rang : le jour actuel
 * suit SON mois (le 14 Brumaire reste le 14 Brumaire), jamais son numéro.
 * `rang` est l'ancien rang (1-indexé) → le nouveau, ou `null` si le mois a
 * disparu (il garde alors son numéro, et `recaler` le ramène dans le calendrier).
 */
function suivreMois(c: CalendarConfigInput, rang: (mois: number) => number | null): CalendarConfigInput {
  const courant = c.currentDate;
  if (!courant || courant.month === null) return c;
  const nouveau = rang(courant.month);
  return nouveau === null || nouveau === courant.month ? c : { ...c, currentDate: { ...courant, month: nouveau } };
}

function appliquer(c: CalendarConfigInput, action: ActionCalendrier): CalendarConfigInput {
  switch (action.type) {
    case "moisRenommer":
      return { ...c, months: c.months.map((m, i) => (i === action.index ? { ...m, name: action.nom } : m)) };
    case "moisDuree": {
      const jours = borne(action.jours, 1, JOURS_PAR_MOIS_MAX);
      return { ...c, months: c.months.map((m, i) => (i === action.index ? { ...m, days: jours } : m)) };
    }
    case "moisDeplacer": {
      const months = echanger(c.months, action.index, action.index + action.sens);
      if (months === c.months) return c;
      const [a, b] = [action.index + 1, action.index + action.sens + 1];
      return suivreMois({ ...c, months }, (m) => (m === a ? b : m === b ? a : m));
    }
    case "moisAjouterApres": {
      if (c.months.length >= MOIS_MAX || action.index < 0 || action.index >= c.months.length) return c;
      const months = [...c.months];
      months.splice(action.index + 1, 0, { name: action.nom, days: 30 });
      return suivreMois({ ...c, months }, (m) => (m > action.index + 1 ? m + 1 : m));
    }
    case "moisSupprimer":
      if (c.months.length <= 1) return c;
      return suivreMois({ ...c, months: c.months.filter((_, i) => i !== action.index) }, (m) => (m > action.index + 1 ? m - 1 : null));
    case "semaineRenommer":
      return { ...c, weekdays: c.weekdays.map((w, i) => (i === action.index ? { name: action.nom } : w)) };
    case "semaineDecaler": {
      const weekdays = echanger(c.weekdays, action.index, action.index + 1);
      if (weekdays === c.weekdays) return c;
      // L'époque suit son jour de semaine : « le 1er jour de l'an 0 était un Primidi » le reste.
      const e = c.weekdayEpoch;
      const weekdayEpoch = e === action.index ? action.index + 1 : e === action.index + 1 ? action.index : e;
      return { ...c, weekdays, weekdayEpoch };
    }
    case "semaineSupprimer": {
      if (c.weekdays.length <= 1) return c;
      const weekdays = c.weekdays.filter((_, i) => i !== action.index);
      // Un jour supprimé avant l'époque la décale d'un rang ; supprimer le jour de l'époque passe au suivant.
      const e = c.weekdayEpoch > action.index ? c.weekdayEpoch - 1 : c.weekdayEpoch;
      return { ...c, weekdays, weekdayEpoch: e % weekdays.length };
    }
    case "semaineAjouter":
      if (c.weekdays.length >= SEMAINE_MAX) return c;
      return { ...c, weekdays: [...c.weekdays, { name: action.nom }] };
    case "epoque":
      return { ...c, weekdayEpoch: borne(action.index, 0, c.weekdays.length - 1) };
    case "ereAjouter":
      if (c.eras.length >= ERES_MAX) return c;
      return { ...c, eras: [...c.eras, { name: action.nom, startYear: 0 }] };
    case "ereRenommer":
      return { ...c, eras: c.eras.map((e, i) => (i === action.index ? { ...e, name: action.nom } : e)) };
    case "ereDebut":
      return { ...c, eras: c.eras.map((e, i) => (i === action.index ? { ...e, startYear: Math.round(action.annee) } : e)) };
    case "ereSupprimer":
      return { ...c, eras: c.eras.filter((_, i) => i !== action.index) };
    case "jourDecaler": {
      const courant = c.currentDate;
      if (!courant || courant.month === null || courant.day === null) return c;
      const date = shiftDate({ year: courant.year, month: courant.month, day: courant.day }, action.n, c);
      return { ...c, currentDate: { ...courant, ...date } };
    }
    case "jourRegler": {
      const date = clampDayToCalendar(action.date, c);
      return { ...c, currentDate: { ...(c.currentDate ?? jourActuelVierge()), ...date, precision: "day" } };
    }
    case "jourInitialiser":
      return { ...c, currentDate: c.currentDate ?? jourActuelVierge() };
  }
}

/** Le reducteur : applique l'action puis recale le jour actuel sur le calendrier obtenu. */
export function reduireCalendrier(calendrier: CalendarConfigInput, action: ActionCalendrier): CalendarConfigInput {
  const suivant = appliquer(calendrier, action);
  return suivant === calendrier ? calendrier : recaler(suivant);
}

/** Le bouton de pas du jour actuel : « + une decade » (10), « + une semaine » (7), sinon « + N jours ». */
export function libellePas(longueurSemaine: number): { cle: "pasDecade" | "pasSemaine" | "pasJours"; n: number } {
  if (longueurSemaine === 10) return { cle: "pasDecade", n: 10 };
  if (longueurSemaine === 7) return { cle: "pasSemaine", n: 7 };
  return { cle: "pasJours", n: longueurSemaine };
}

/** Vrai quand le calendrier courant differe de celui enregistre. */
export function aDesModifications(initial: CalendarConfigInput, courant: CalendarConfigInput): boolean {
  return JSON.stringify(initial) !== JSON.stringify(courant);
}

/** Le schema refuse un nom vide : « Enregistrer » reste ferme tant qu'un mois, un jour de semaine ou une ere n'a pas de nom. */
export function calendrierValide(calendrier: CalendarConfigInput): boolean {
  const nomme = (x: { name: string }) => x.name.trim().length > 0;
  return calendrier.months.every(nomme) && calendrier.weekdays.every(nomme) && calendrier.eras.every(nomme);
}
