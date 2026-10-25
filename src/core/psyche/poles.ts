import { bandTierFor, type BandTier } from "./bands";

/**
 * V3.1-69 — le nom d'un pôle à l'écran. Le genre grammatical est une DONNÉE
 * de la table des pôles (`src/i18n/fr.ts`), jamais deviné d'après la
 * terminaison du mot : « Altruisme » est masculin, « Dureté » féminin.
 */
export interface PoleEnd {
  label: string;
  gender: "m" | "f";
}

/** Les deux bouts d'un pôle : `positive` côté +100, `negative` côté −100. */
export interface PoleEnds {
  positive: PoleEnd;
  negative: PoleEnd;
}

export const NEUTRAL_POLE_LABEL = "neutre — ne s'en soucie pas";

/** Intensité de chaque bande non neutre, accordée selon le genre (« extrême » est invariable). */
const INTENSITY: Record<Exclude<BandTier, "neutral">, { m: string; f: string }> = {
  extreme_neg: { m: "extrême", f: "extrême" },
  strong_neg: { m: "fort", f: "forte" },
  slight_neg: { m: "léger", f: "légère" },
  slight_pos: { m: "léger", f: "légère" },
  strong_pos: { m: "fort", f: "forte" },
  extreme_pos: { m: "extrême", f: "extrême" },
};

/**
 * Le nom de la bande d'un pôle : « neutre — ne s'en soucie pas » pour la
 * bande 0, sinon le pôle du côté de la valeur et son intensité accordée
 * (« Altruisme fort », « Dureté légère », « Circonspection extrême »). Les
 * seuils sont ceux de `bandTierFor`.
 */
export function poleBandLabel(ends: PoleEnds, value: number): string {
  const tier = bandTierFor(value);
  if (tier === "neutral") return NEUTRAL_POLE_LABEL;
  const end = value > 0 ? ends.positive : ends.negative;
  return `${end.label} ${INTENSITY[tier][end.gender]}`;
}
