import { z } from "zod";

/** `#RRGGBB` seulement — jamais `rgb()`/nommees, un seul format a valider partout (saisie, stockage, rendu SVG direct). */
export const zMapRegionColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).");
export type MapRegionColor = z.infer<typeof zMapRegionColor>;

/**
 * Couleur d'une zone tout juste tracee, avant que la personne n'en choisisse
 * une. Nommee ici, a cote du format qu'elle respecte, parce qu'elle etait
 * ecrite en dur a DEUX endroits sans lien entre eux (le schema de creation
 * et le composant de trace) : changer l'un laissait l'autre diverger en
 * silence.
 *
 * Litterale, et non un jeton de `tokens.css` : c'est une DONNEE, stockee
 * dans `map_regions.fill_color` et rendue en attribut SVG, pas une couleur
 * d'interface (docs/CHARTE-UI.md §2 vise le style, jamais le contenu). Une
 * variable CSS n'y aurait aucun sens — elle changerait retroactivement la
 * couleur de zones deja enregistrees, et le selecteur de couleur ne saurait
 * pas quoi afficher.
 */
export const DEFAULT_MAP_REGION_FILL = "#3b82f6";
export const DEFAULT_MAP_REGION_BORDER = "#1d4ed8";

/** Sommet normalise (0-1), memes conventions que x/y de map_pins — jamais des pixels, casserait a chaque remplacement d'image. */
export const zMapRegionPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type MapRegionPoint = z.infer<typeof zMapRegionPoint>;

/** Polygone : au moins 3 sommets, sinon ce n'est pas une zone. */
export const zMapRegionShape = z.array(zMapRegionPoint).min(3, "Une zone a besoin d'au moins 3 sommets.");
export type MapRegionShape = z.infer<typeof zMapRegionShape>;
