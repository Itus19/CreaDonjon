/**
 * Grille de disponibilités (V3.1-8, retour utilisateur : "quasi copié-collé
 * de ce que propose crab.fit") — deux usages de la même grille temps × date :
 * la joueuse y peint une plage continue par jour (le modèle de données reste
 * "un début/une fin par jour", V2.1-4 — la grille n'est qu'une façon de la
 * peindre), le MJ y lit une carte de chaleur (case teintée selon le nombre
 * de joueuses couvrant ce créneau précis, infobulle au survol).
 */

export function generateSlots(startMinutes: number, endMinutes: number, step: number): number[] {
  const slots: number[] = [];
  for (let t = startMinutes; t + step <= endMinutes; t += step) slots.push(t);
  return slots;
}

/**
 * Cases peintes → une seule plage continue (retour utilisateur V2.1-4 :
 * "jamais deux disponibilités disjointes le même soir") — comble les trous
 * plutôt que de les refuser : `[min, max]` des cases peintes, jamais un
 * ensemble de sous-plages.
 */
export function rangeFromSlots(slotStarts: readonly number[], step: number): { startMinutes: number; endMinutes: number } | null {
  if (slotStarts.length === 0) return null;
  return { startMinutes: Math.min(...slotStarts), endMinutes: Math.max(...slotStarts) + step };
}

export interface SlotResponse {
  date: string;
  userId: string;
  startsAt: number;
  endsAt: number;
}

export interface HeatmapCell {
  date: string;
  slotStart: number;
  userIds: string[];
}

/** Une case par (date, créneau), même sans réponse — le MJ doit voir toute sa proposition, pas seulement ce qui a déjà une réponse. */
export function buildHeatmap(dates: readonly string[], slots: readonly number[], step: number, responses: readonly SlotResponse[]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (const date of dates) {
    for (const slotStart of slots) {
      const slotEnd = slotStart + step;
      const userIds = responses.filter((r) => r.date === date && r.startsAt <= slotStart && r.endsAt >= slotEnd).map((r) => r.userId);
      cells.push({ date, slotStart, userIds });
    }
  }
  return cells;
}
