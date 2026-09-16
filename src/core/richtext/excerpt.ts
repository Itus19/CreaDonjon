import type { Segment } from "@/src/core/schemas/entities/segments";
import { CHIP_SUMMARY_MAX_LENGTH } from "@/src/core/rules/chipSummary";

/**
 * Premier paragraphe d'une fiche, reduit a du texte brut (V2.1-18 lot 2) —
 * l'extrait que porte la carte d'apercu au survol d'un lien.
 *
 * Deliberement jumeau de `chipSummaryFromDescription`
 * (`src/core/rules/chipSummary.ts`) : meme intention (deux ou trois lignes
 * sous un nom), donc meme longueur, importee plutot que recopiee. Ce qui
 * differe est la FORME de l'entree, et elle seule — une description de
 * regle est une liste de `{ text }`, un corps d'entite une liste de
 * segments typees dont le contenu est une suite de noeuds. D'ou deux
 * fonctions et non une generique : ce qu'elles ont en commun tient dans
 * une constante.
 *
 * `null`, jamais la chaine vide : l'appelant doit pouvoir distinguer
 * "cette fiche n'a pas de prose" de "sa prose est vide", et ne pas poser
 * de carte du tout dans le premier cas.
 */
export function excerptFromSegments(segments: readonly Segment[]): string | null {
  for (const segment of segments) {
    // Seuls les paragraphes : un titre est une etiquette, pas un resume, et
    // un `divider` n'a par construction aucun contenu.
    if (segment.blockType !== "paragraph") continue;
    const flattened = flatten(segment.content);
    if (flattened !== null) return truncate(flattened);
  }
  return null;
}

/**
 * Aplatit les noeuds inline en texte. Un noeud `ref` porte son libelle dans
 * `label` et non dans `v` : l'oublier ferait disparaitre le premier mot de
 * tout paragraphe qui commence par un lien — et ils sont nombreux dans un
 * Livre de sessions. Les marques (gras, italique, caviardage) tombent :
 * une carte d'apercu n'est pas interactive, et un caviardage n'aurait
 * aucun sens hors de son paragraphe.
 */
function flatten(content: Segment["content"]): string | null {
  const raw = content.map((node) => (node.t === "ref" ? node.label : node.v)).join("");
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function truncate(text: string): string {
  if (text.length <= CHIP_SUMMARY_MAX_LENGTH) return text;

  const cut = text.slice(0, CHIP_SUMMARY_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  // Un mot unique plus long que la limite n'offre aucune frontiere : on
  // coupe net plutot que de rendre le paragraphe entier.
  const trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.…]+$/, "");
  return `${trimmed}…`;
}
