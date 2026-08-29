/**
 * Couleur d'une relation (V2-H1, decrite par l'utilisateur pour le radar
 * du bloc `relationship` ET les liens du futur graphe `worldview`, V2-H1
 * phase 4) : blanc neutre au centre, degrade vers le vert (amical) ou le
 * rouge (hostile) selon `friendship_hostility`, rose si le type de
 * relation est romantique — qui l'emporte sur le degrade, une rupture
 * amere reste visuellement "romance", pas "hostile".
 *
 * OKLCH direct (pas un jeton `tokens.css`) : une couleur DERIVEE en continu
 * d'une valeur, pas une des quelques teintes fixes que les jetons
 * existants encodent (ecoles de magie, poles de temperament).
 */

const ROMANTIC_RELATION_TYPES = new Set(["partner_of", "married_to", "ex_partner_of"]);

const FRIENDLY_HUE = 145;
const HOSTILE_HUE = 25;
const ROMANTIC_HUE = 340;
/** Chroma au neutre (0) — jamais 0 pur, pour rester visible comme "gris neutre" plutot que blanc invisible sur un fond clair. */
const MIN_CHROMA = 0.01;
const MAX_CHROMA = 0.14;
const LIGHTNESS = 0.72;

export function relationshipColor(friendshipHostility: number, relationTypes: string[] = []): string {
  if (relationTypes.some((t) => ROMANTIC_RELATION_TYPES.has(t))) {
    return `oklch(${LIGHTNESS} ${MAX_CHROMA} ${ROMANTIC_HUE})`;
  }
  const magnitude = Math.min(100, Math.abs(friendshipHostility)) / 100;
  const chroma = MIN_CHROMA + magnitude * (MAX_CHROMA - MIN_CHROMA);
  const hue = friendshipHostility >= 0 ? FRIENDLY_HUE : HOSTILE_HUE;
  return `oklch(${LIGHTNESS} ${chroma.toFixed(3)} ${hue})`;
}
