"use client";

import Clock from "./Clock";
import RadioWidget from "./RadioWidget";

/**
 * Radio + heure, en pastille flottante en haut a droite (V2.1-16) — ce qui
 * reste du coin droit de l'en-tete supprime. Le nom du monde et la sortie,
 * eux, sont passes en tete des barres laterales (`WorldSidebarHeader`).
 *
 * Rendue par `WindowsDesktop`, DANS la zone de travail, et non a cote comme
 * au premier jet : l'auteur a choisi qu'une fiche maximisee la recouvre, et
 * la zone de travail est une pile d'empilement (`z-index` sur son
 * conteneur). Depuis l'exterieur, "sous les fenetres" voulait donc dire
 * "sous toute la zone" — pastille invisible aux clics, verifie en
 * navigateur (`elementFromPoint` renvoyait le fond de la zone). A
 * l'interieur, `z-10` la place au-dessus du fond et sous les fenetres
 * (`z-20`/`z-30`), ce qui est exactement la demande.
 *
 * Le bouton de des, lui, reste au-dessus de tout (`z-60`, `DiceRollPanel`) :
 * c'est un outil de seance, pas un reglage.
 */
export default function ChromePill({
  worldSlug,
  fixed = false,
}: {
  worldSlug: string;
  /** Vue telephone : aucune fenetre flottante n'existe, donc aucune zone de travail a laquelle s'ancrer. */
  fixed?: boolean;
}) {
  return (
    <div
      className={`${
        fixed ? "fixed z-[5]" : "absolute z-10"
      } right-4 top-3 flex items-center gap-3 rounded-full border border-edge bg-panel/90 px-3 py-1.5 backdrop-blur-[var(--blur)] print:hidden`}
    >
      <RadioWidget worldSlug={worldSlug} />
      <Clock />
    </div>
  );
}
