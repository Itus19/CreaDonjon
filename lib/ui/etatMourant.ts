import { isDead, isStabilized, type DeathSaves } from "@/src/core/rules/deathSaves";

export type EtatMourant = "vivant" | "mourant" | "stabilisé" | "mort";

/**
 * Ce que la fiche affiche à la place de la jauge de PV (V3.1-32).
 *
 * Aucune règle propre ici : « mort » et « stabilisé » se LISENT dans
 * `death_saves` par les fonctions du noyau (`isDead`, `isStabilized`, seuil 3),
 * comme le serveur. Au-dessus de 0 PV on est vivant, quels que soient les jets
 * restés en base.
 */
export function etatMourant(hp: { current: number }, deathSaves: DeathSaves): EtatMourant {
  if (hp.current > 0) return "vivant";
  const etat = { hp: { current: hp.current, max: 0, temp: 0 }, conditions: [], deathSaves };
  if (isDead(etat)) return "mort";
  if (isStabilized(etat)) return "stabilisé";
  return "mourant";
}
