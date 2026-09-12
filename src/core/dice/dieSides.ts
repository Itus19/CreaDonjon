/**
 * Type de de lu dans une formule deja mise en forme ("1d20+7", "1d4+4") —
 * sert au dessin du de sur les boutons de jet de l'onglet Actions (retour
 * utilisateur : "que le dessin s'adapte au type de des lance").
 *
 * Pourquoi lire la chaine plutot que recevoir un `FormulaNode` : les boutons
 * reçoivent deja leur formule sous forme de texte, et pour un sort elle passe
 * par `resolveScaledFormulaText` qui rend une chaine, jamais un noeud. Une
 * seule lecture, la meme pour une arme et pour un sort.
 */

/** Les seules formes reellement dessinees (`DieIcon`). Un de hors de cette liste n'a pas d'icone : mieux vaut aucun dessin qu'un dessin faux. */
export const DIE_SHAPES = [4, 6, 8, 10, 12, 20] as const;
export type DieSides = (typeof DIE_SHAPES)[number];

const SHAPES = new Set<number>(DIE_SHAPES);

// Frontiere de mot a gauche pour ne pas lire le "D 15" de "DD 15" comme un
// de, et pour ne rien attraper au milieu d'un identifiant.
const DIE_RE = /(?:^|[^a-zA-Z0-9])\d*d(\d+)/i;

export function dieSidesFromFormula(text: string): DieSides | null {
  const match = DIE_RE.exec(text);
  if (!match) return null;
  const sides = Number(match[1]);
  return SHAPES.has(sides) ? (sides as DieSides) : null;
}
