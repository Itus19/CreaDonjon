/**
 * Chevauchement de disponibilités horaires (V2.1-4, retour utilisateur :
 * "c'est les matchs jour+plage horaire+durée qui doivent se mettre en
 * avant"). Une seule plage par jour et par joueuse (cas réel : personne
 * n'indique deux disponibilités disjointes le même soir) — l'intersection
 * de plusieurs plages est donc simplement `[max(débuts), min(fins)]`.
 * Temps en minutes depuis minuit tout du long : entier, comparable, pas de
 * piège de fuseau horaire pour un calcul purement local à la journée.
 */

export interface DayAvailabilityEntry {
  userId: string;
  startsAt: number;
  endsAt: number;
}

export interface OverlapWindow {
  start: number;
  end: number;
  durationMinutes: number;
}

export type SessionCategory = "full" | "short" | "none";

export interface DayCandidate {
  date: string;
  /** Nombre de joueuses ayant indiqué une disponibilité ce jour (peut être < `totalMembers`). */
  participantCount: number;
  totalMembers: number;
  overlap: OverlapWindow;
  category: SessionCategory;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Intersection des plages d'un jour — `null` s'il n'y a personne. Une seule joueuse : l'intersection est sa propre plage. Plages disjointes : durée à 0, jamais négative. */
export function computeOverlap(entries: readonly DayAvailabilityEntry[]): OverlapWindow | null {
  if (entries.length === 0) return null;
  const start = Math.max(...entries.map((e) => e.startsAt));
  const end = Math.min(...entries.map((e) => e.endsAt));
  return { start, end, durationMinutes: Math.max(0, end - start) };
}

/** `targetMinutes` : durée de session visée, réglable par le MJ (retour utilisateur : pas figée à 5h pour toutes les tables). */
export function classifySession(durationMinutes: number, targetMinutes: number): SessionCategory {
  if (durationMinutes <= 0) return "none";
  return durationMinutes >= targetMinutes ? "full" : "short";
}

const CATEGORY_RANK: Record<SessionCategory, number> = { full: 0, short: 1, none: 2 };

/** Trie les jours candidats : catégorie (complète > raccourcie > aucune), puis nombre de participantes, puis durée — jour le plus proche de "ce qu'on cherche vraiment" en tête. */
export function rankDays(days: readonly DayCandidate[]): DayCandidate[] {
  return [...days].sort((a, b) => {
    const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (byCategory !== 0) return byCategory;
    const byCount = b.participantCount - a.participantCount;
    if (byCount !== 0) return byCount;
    const byDuration = b.overlap.durationMinutes - a.overlap.durationMinutes;
    if (byDuration !== 0) return byDuration;
    return a.date.localeCompare(b.date);
  });
}
