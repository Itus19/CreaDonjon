import type { Rng } from "../dice/rng";

/**
 * Poles initiaux pour un PNJ genere (generateur "PNJ", specs/outils-mj.md
 * §3) — bornes a [-60, 60] plutot que [-100, 100] : au-dela de 67 la bande
 * est deja "extreme" (specs/psyche-pnj.md §1.5), et un PNJ tout juste ne
 * commence pas sa vie a la fiche a un extremum. Les evenements de jeu
 * restent le seul chemin pour l'y amener.
 */
const MAX_INITIAL_POLE_MAGNITUDE = 60;

function randomPoleValue(rng: Rng): number {
  return rng.nextInt(2 * MAX_INITIAL_POLE_MAGNITUDE + 1) - MAX_INITIAL_POLE_MAGNITUDE;
}

export function randomPoles<K extends string>(keys: readonly K[], rng: Rng): { key: K; value: number }[] {
  return keys.map((key) => ({ key, value: randomPoleValue(rng) }));
}

/** Les poles les plus marques deviennent `priority` (specs/psyche-pnj.md §2, "le champ le plus utile du bloc"). */
export function priorityFromPoles<K extends string>(poles: readonly { key: K; value: number }[], count = 2): K[] {
  return [...poles]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, count)
    .map((p) => p.key);
}
