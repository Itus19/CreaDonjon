import type { HeatmapCell } from "./availabilityGrid";

/**
 * Le meilleur créneau d'un jour (V3.1-16) : la plus longue plage où le **plus
 * grand nombre** de personnes est disponible — et toujours les mêmes, d'une
 * demi-heure à l'autre.
 *
 * Remplace, pour le classement des dates, l'intersection de TOUTES les
 * réponses du jour (`computeOverlap`) : une seule joueuse disponible le matin
 * suffisait à classer le jour « aucun créneau commun », alors que quatre autres
 * pouvaient jouer 5 h l'après-midi.
 *
 * Calculé sur les cases de la carte de chaleur (`buildHeatmap`), qui disent
 * déjà qui couvre chaque demi-heure : pas une seconde lecture des réponses.
 */
export interface BestDay {
  date: string;
  /** Personnes présentes sur tout le créneau retenu. */
  count: number;
  start: number;
  end: number;
  durationMinutes: number;
  userIds: string[];
  /** Personnes ayant répondu pour ce jour, même hors du créneau retenu. */
  respondentCount: number;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** `null` si personne n'est disponible ce jour-là : le jour ne figure pas dans les dates possibles. */
export function bestWindowForDay(date: string, cells: readonly HeatmapCell[], step: number): BestDay | null {
  const ordered = cells.filter((c) => c.date === date).sort((a, b) => a.slotStart - b.slotStart);
  const respondents = new Set(ordered.flatMap((c) => c.userIds));
  if (respondents.size === 0) return null;

  const max = Math.max(...ordered.map((c) => c.userIds.length));
  let best: { from: number; to: number; userIds: string[] } | null = null;
  let run: { from: number; to: number; userIds: string[] } | null = null;

  for (const cell of ordered) {
    const extends_ = run !== null && cell.userIds.length === max && cell.slotStart === run.to && sameSet(cell.userIds, run.userIds);
    if (extends_ && run) {
      run.to = cell.slotStart + step;
    } else {
      run = cell.userIds.length === max ? { from: cell.slotStart, to: cell.slotStart + step, userIds: [...cell.userIds] } : null;
    }
    if (run && (!best || run.to - run.from > best.to - best.from)) best = { ...run };
  }

  if (!best) return null;
  return {
    date,
    count: max,
    start: best.from,
    end: best.to,
    durationMinutes: best.to - best.from,
    userIds: best.userIds,
    respondentCount: respondents.size,
  };
}

/** Plus de présents d'abord, puis le plus long créneau, puis la date la plus proche. */
export function rankBestDays(days: readonly BestDay[]): BestDay[] {
  return [...days].sort((a, b) => b.count - a.count || b.durationMinutes - a.durationMinutes || a.date.localeCompare(b.date));
}

/**
 * Le dénominateur du décompte (« 5/6 ») : les personnes **attendues à la
 * table** — les joueuses, le MJ qui a ouvert la demande, et tout autre membre
 * qui a répondu. Pas un second MJ silencieux : compter tous les membres
 * faisait paraître la table moins disponible qu'elle ne l'est.
 */
export function expectedAtTable(
  members: readonly { user_id: string; role: string }[],
  requestCreatorId: string,
  respondentIds: readonly string[] = []
): string[] {
  const ids = members.filter((m) => m.role === "player").map((m) => m.user_id);
  for (const id of [requestCreatorId, ...respondentIds]) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
