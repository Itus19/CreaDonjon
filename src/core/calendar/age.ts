import type { GameDate } from "./types";

/**
 * Age et naissance au calendrier du monde (V3.1-48, ADR 0063). Regle 16 :
 * l'age n'est jamais stocke, il se derive de la date de naissance et de la
 * date du jour en jeu. Fonctions pures : un « anniversaire » est la paire
 * (mois, jour) comparee dans l'ordre du calendrier, sans connaitre la
 * longueur des mois — deux dates de la meme annee se comparent tres bien
 * par (mois, jour).
 */

/** Vrai si l'anniversaire (mois, jour) est strictement apres la date du jour dans l'annee. Un mois ou un jour inconnu compte comme le 1er ; un mois inconnu = anniversaire jamais « a venir » (on ne sait pas). */
function birthdayStillAhead(
  birthMonth: number | null,
  birthDay: number | null,
  todayMonth: number | null,
  todayDay: number | null
): boolean {
  if (birthMonth === null || todayMonth === null) return false;
  if (birthMonth !== todayMonth) return birthMonth > todayMonth;
  return (birthDay ?? 1) > (todayDay ?? 1);
}

/** Age en annees revolues a la date `today`. Jamais negatif. */
export function ageAt(birth: GameDate, today: GameDate): number {
  const years = today.year - birth.year - (birthdayStillAhead(birth.month, birth.day, today.month, today.day) ? 1 : 0);
  return Math.max(0, years);
}

/** Annee de naissance d'un personnage de `age` ans a la date `today`, ne un `birthDay` du mois `birthMonth` (inverse de `ageAt`). */
export function birthYearFromAge(
  age: number,
  birthMonth: number | null,
  birthDay: number | null,
  today: GameDate
): number {
  return today.year - age - (birthdayStillAhead(birthMonth, birthDay, today.month, today.day) ? 1 : 0);
}
