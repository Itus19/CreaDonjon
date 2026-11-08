import type { GameDate } from "./types";

type DatePart = { year: number; month: number | null; day: number | null };

/**
 * Forme acceptee : une date telle que lue en base, ou elle a pu etre ecrite
 * avant que `end`/`label` existent (le schema Zod les complete a `null`).
 */
type GameDateLike = Omit<GameDate, "end" | "label"> & { end?: DatePart | null; label?: string | null };

function samePart(a: DatePart | null | undefined, b: DatePart | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Deux dates de jeu sont-elles la meme ? Compare champ par champ, jamais par
 * `JSON.stringify` : une colonne `jsonb` reordonne les cles d'un objet (les
 * plus courtes d'abord), alors qu'un objet passe par Zod suit l'ordre du
 * schema. Les deux chaines different pour une meme date — c'est ce qui
 * bloquait la montee de niveau de tout personnage ne (8 novembre 2026).
 */
export function sameGameDate(a: GameDateLike | null | undefined, b: GameDateLike | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return samePart(a, b) && a.precision === b.precision && samePart(a.end, b.end) && (a.label ?? null) === (b.label ?? null);
}
