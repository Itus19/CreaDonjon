import { BAND_TIERS, bandTierFor, type BandTier } from "./bands";
import { RELATIONSHIP_AXIS_KEYS, type RelationshipAxisKey } from "./keys";

/**
 * V3.2-13/14 (ADR 0111) — L'attitude PERÇUE : ce qu'un PNJ laisse voir au
 * personnage, pas ce qu'il ressent.
 *
 * Deux séries d'axes : `ressenti` (`entity_attitudes.axes`) et `facade`
 * (ce qu'il montre, quand c'est différent). Sans façade, le perçu est le
 * ressenti. La façade l'emporte axe par axe : un PNJ peut feindre l'amitié
 * sans rien masquer d'autre.
 *
 * Sortie en bandes nommées, jamais en nombre (specs/psyche-pnj.md §1.5) :
 * c'est ce qui part à l'écran.
 */

export type Axes = Partial<Record<RelationshipAxisKey, number>>;

export type BandePositive = Extract<BandTier, "slight_pos" | "strong_pos" | "extreme_pos">;

export interface PerceptionPercue {
  /** Amitié perçue, de « haineux » à « dévoué ». */
  friendship: BandTier;
  /** Attirance perçue, seulement quand elle est positive (intrigué·e, attiré·e, épris·e) : sinon `null`, rien à montrer. */
  attraction: BandePositive | null;
}

const AXES_CONNUS = new Set<string>(RELATIONSHIP_AXIS_KEYS);

/** Rétrécit un `jsonb` lu en base vers des axes : seules les clés connues à valeur numérique finie survivent. */
export function axesDepuisJson(valeur: unknown): Axes | null {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const axes: Axes = {};
  for (const [cle, v] of Object.entries(valeur)) {
    if (AXES_CONNUS.has(cle) && typeof v === "number" && Number.isFinite(v)) axes[cle as RelationshipAxisKey] = v;
  }
  return axes;
}

function estPositive(bande: BandTier): bande is BandePositive {
  return bande === "slight_pos" || bande === "strong_pos" || bande === "extreme_pos";
}

/** `null` quand aucune attitude n'existe envers le personnage : on ne sait rien, on n'affiche pas « indifférent ». */
export function perceptionPercue(ressenti: Axes | null, facade: Axes | null): PerceptionPercue | null {
  if (!ressenti && !facade) return null;
  const valeur = (axe: RelationshipAxisKey) => facade?.[axe] ?? ressenti?.[axe] ?? 0;
  const attraction = bandTierFor(valeur("attraction_repulsion"));
  return {
    friendship: bandTierFor(valeur("friendship_hostility")),
    attraction: estPositive(attraction) ? attraction : null,
  };
}

/** Le nombre de crans entre deux bandes : à deux ou plus, le changement est signalé (specs/psyche-pnj.md §5). */
export function ecartDeCrans(a: BandTier, b: BandTier): number {
  return Math.abs(BAND_TIERS.indexOf(a) - BAND_TIERS.indexOf(b));
}
