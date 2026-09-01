export interface CurrencySnapshotDelta {
  beforeCp: number;
  afterCp: number;
}

export interface EconomyStats {
  /** Somme des augmentations de valeur (en pieces de cuivre) entre deux instantanes consecutifs — jamais une simple somme des soldes finaux. */
  earnedCp: number;
  /** Somme des diminutions, toujours positive (valeur absolue). */
  spentCp: number;
}

/** Retour utilisateur (V2-M12) : "argent dépensé, argent gagné" — un instantane par revision d'un personnage, comme `computeDiceStats` (rollStats.ts) agrege des jets bruts sans connaitre leur origine (session, campagne...). */
export function computeEconomyStats(deltas: CurrencySnapshotDelta[]): EconomyStats {
  let earnedCp = 0;
  let spentCp = 0;
  for (const { beforeCp, afterCp } of deltas) {
    const delta = afterCp - beforeCp;
    if (delta > 0) earnedCp += delta;
    else if (delta < 0) spentCp += -delta;
  }
  return { earnedCp, spentCp };
}
