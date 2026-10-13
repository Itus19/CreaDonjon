/**
 * Recharge des compteurs du personnage au repos (V3.1-113, ADR 0045). Pure.
 * La valeur stockée est le nombre d'utilisations CONSOMMÉES.
 *
 * - `short_rest` : tout rendu au repos court et au repos long.
 * - `short_rest_one` (Rage, Conduit divin, Forme sauvage, Second souffle
 *   en 2024) : UNE rendue au repos court, toutes au repos long.
 * - `long_rest` : tout rendu au repos long.
 * - `dawn`, `never` : un repos n'y touche pas.
 */
export type RechargeKind = "short_rest" | "short_rest_one" | "long_rest" | "dawn" | "never";

export function rechargeTrackers(
  trackers: readonly { id: string; recharge: RechargeKind }[],
  used: Readonly<Record<string, number>>,
  rest: "short" | "long"
): Record<string, number> {
  const next = { ...used };
  for (const tracker of trackers) {
    const spent = used[tracker.id] ?? 0;
    if (tracker.recharge === "short_rest") next[tracker.id] = 0;
    else if (tracker.recharge === "short_rest_one") next[tracker.id] = rest === "long" ? 0 : Math.max(0, spent - 1);
    else if (tracker.recharge === "long_rest" && rest === "long") next[tracker.id] = 0;
  }
  return next;
}
