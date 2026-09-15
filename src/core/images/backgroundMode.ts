/**
 * V2.1-10 lot 2 — le fond de page a trois etats, pas deux.
 *
 * Jusqu'ici `useAsWikiBackground` etait EXCLUSIF : cocher la case retirait
 * l'image du corps de la fiche (`PublicBlockView` renvoyait `null`), et rien
 * ne permettait de l'avoir aux deux endroits a la fois. L'auteur voulait les
 * trois combinaisons.
 *
 * Deux booleens plutot qu'un champ a trois valeurs, pour une raison precise :
 * `useAsWikiBackground` porte deja une regle SERVEUR d'unicite par fiche
 * (`clearOtherWikiBackgrounds`, src/server/services/blocks.ts) et un index de
 * lecture. Le renommer pour un besoin d'affichage aurait deplace cette regle
 * sans la rendre meilleure. `alsoShowInFlow` s'ajoute a cote, defaut `false`
 * — donc un bloc pose avant ce lot se comporte exactement comme avant, sans
 * migration ni reecriture.
 *
 * Le couple n'a que trois etats utiles : la quatrieme combinaison
 * (`alsoShowInFlow` sans fond) ne veut rien dire, puisqu'une image qui n'est
 * pas un fond est deja dans la fiche. `backgroundModeOf` l'absorbe plutot que
 * de laisser un etat fantome se propager dans le rendu.
 */

/** `none` : pas de fond. `also` : fond ET dans la fiche. `only` : fond seul, retiree du corps de page. */
export type ImageBackgroundMode = "none" | "also" | "only";

/** Forme minimale lue ici — la donnee brute d'un bloc image la satisfait, champs absents compris. */
interface BackgroundFields {
  useAsWikiBackground?: boolean;
  alsoShowInFlow?: boolean;
}

export function backgroundModeOf(data: BackgroundFields | null | undefined): ImageBackgroundMode {
  if (data?.useAsWikiBackground !== true) return "none";
  return data.alsoShowInFlow === true ? "also" : "only";
}

export function withBackgroundMode(mode: ImageBackgroundMode): Required<BackgroundFields> {
  return {
    useAsWikiBackground: mode !== "none",
    alsoShowInFlow: mode === "also",
  };
}

/**
 * Cette image doit-elle etre rendue a sa place dans la fiche ?
 *
 * `false` pour le seul mode « seulement en fond » : l'image est deja peinte
 * par `WikiBackgroundProvider` en plein ecran, la rendre aussi dans le corps
 * la montrerait deux fois.
 */
export function showsInPage(data: BackgroundFields | null | undefined): boolean {
  return backgroundModeOf(data) !== "only";
}
