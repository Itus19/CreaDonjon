/**
 * AG-1 — ce qu'un catalogue de monstres sait d'une fiche : facteur de
 * puissance, PX, type, taille.
 *
 * Un monstre du SRD porte ces valeurs dans ses données d'import
 * (`source_raw`). Un monstre saisi à la main dans un ruleset personnel n'en a
 * pas : ses valeurs vivent dans son bloc de statistiques (`stat_block`). Le
 * catalogue ne lisait que les premières, et écartait en silence tous les
 * monstres saisis à la main : la recherche de l'Initiative restait vide.
 *
 * Les PX ne sont jamais déduits du FP (choix de `encounter.ts` : pas de table
 * de correspondance inventée). Un bloc sans PX rend `xp: null` : le monstre
 * s'ajoute à l'Initiative, mais pas au budget d'une rencontre.
 */

export interface ChampsMonstre {
  challengeRating: number;
  xp: number | null;
  type: string;
  size: string;
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : null;
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : "";
}

export function champsMonstre(sourceRaw: unknown, statBlock: unknown): ChampsMonstre | null {
  const raw = objet(sourceRaw);
  if (raw && typeof raw.challenge_rating === "number" && typeof raw.xp === "number") {
    return { challengeRating: raw.challenge_rating, xp: raw.xp, type: texte(raw.type), size: texte(raw.size) };
  }
  const bloc = objet(statBlock);
  if (bloc && typeof bloc.challenge_rating === "number") {
    return {
      challengeRating: bloc.challenge_rating,
      xp: typeof bloc.xp === "number" ? bloc.xp : null,
      type: texte(bloc.creature_type),
      size: texte(bloc.size),
    };
  }
  return null;
}
