import { BAND_TIERS, bandTierFor } from "./bands";
import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "./keys";

/** Un pôle de convictions tel que le bloc `worldview` le stocke. */
interface PoleValue {
  key: WorldviewPoleKey;
  value: number;
}

/** À partir de cet écart (en crans), deux convictions « divergent » (specs/psyche-pnj.md §2). */
export const TENSION_THRESHOLD = 3;

/** Le cran d'une valeur : −3 (extrême négatif) à +3 (extrême positif), 0 pour la bande neutre. */
function notch(value: number): number {
  return BAND_TIERS.indexOf(bandTierFor(value)) - 3;
}

export interface WorldviewTension {
  key: WorldviewPoleKey;
  /** Écart en crans (0 à 6) entre les deux bandes. */
  gap: number;
  /** `true` à partir de 3 crans. */
  tension: boolean;
}

/**
 * Compare les convictions d'une entité à celles de sa faction : l'axe au plus
 * grand écart, mesuré en CRANS (différence des bandes, pas des valeurs). Seuls
 * les pôles saisis des deux côtés se comparent — un pôle absent n'est pas un
 * pôle à 0. À écart égal, l'axe le premier dans l'ordre des pôles gagne.
 * `null` s'il n'y a aucun pôle en commun.
 */
export function worldviewTension(
  entity: readonly PoleValue[],
  faction: readonly PoleValue[],
): WorldviewTension | null {
  let best: WorldviewTension | null = null;
  for (const key of WORLDVIEW_POLE_KEYS) {
    const a = entity.find((p) => p.key === key);
    const b = faction.find((p) => p.key === key);
    if (!a || !b) continue;
    const gap = Math.abs(notch(a.value) - notch(b.value));
    if (!best || gap > best.gap) best = { key, gap, tension: gap >= TENSION_THRESHOLD };
  }
  return best;
}
