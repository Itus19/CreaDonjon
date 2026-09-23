import type { ReactNode } from "react";

/**
 * La taille des deux glyphes ▲ et ▼.
 *
 * Sortie en constante pour porter son exception au seul endroit qui la
 * justifie. V2.1-27 pose un plancher de 12 px sur les tailles de texte ; il
 * protège la lisibilité d'un LIBELLÉ. Ici il n'y a pas de libellé, mais une
 * flèche décorative dans une bande de 16 px, qu'un corps de 12 px ferait
 * déborder. Ce que la règle visait vraiment — la cible de clic — fait bien
 * 24 px (voir plus bas).
 */
// eslint-disable-next-line no-restricted-syntax -- glyphe, pas libellé : voir ci-dessus.
const TAILLE_GLYPHE = "text-[9px]";

/**
 * Case "compteur" a bande pleine largeur (retour utilisateur : remplacer
 * les petits ronds +/- par ce style, deja invente pour Initiative/CA dans
 * `InitiativeTracker.tsx` mais jamais partage) — quatrieme site direct
 * (epuisement, achat de points, pieces, PV/PX de la fiche jouable), donc
 * extrait ici plutot que recopie une cinquieme fois. Le contenu central est
 * libre : un `<span>` pour un compteur clic-a-clic (Initiative, epuisement,
 * achat de points), ou un `<input>` pour un montant tape puis applique
 * (PV/PX, pieces) — cette case ne decide jamais laquelle, seulement
 * `onIncrement`/`onDecrement`.
 *
 * Hauteur INTRINSEQUE, jamais fixee par `className` (retour utilisateur :
 * une hauteur devinee en pixels coupait l'affichage de la valeur — jusqu'a
 * ne laisser que 4px pour un texte qui en demandait 12). Les deux bandes
 * flechees gardent une hauteur fixe (`h-4`), le contenu central prend la
 * hauteur que sa police exige — `className` ne doit fournir qu'une largeur
 * (`w-*`).
 *
 * V2.1-27 — LA CIBLE DE CLIC FAIT 24 px, LE DESSIN N'A PAS BOUGE.
 *
 * Les bandes mesuraient 16 px de haut, la charte en demande 24 (§4). Sur un
 * ecran tactile, 16 px se rate — et ce sont exactement les compteurs qu'on
 * manipule en jouant (PV, epuisement, bourse). Les grossir aurait rallonge
 * les dix appels du composant, dont une rangee de badges deja serree.
 *
 * La charte donne elle-meme le remede : « etendre la zone cliquable sans
 * grossir le visuel ». Chaque bande porte donc un pseudo-element de 24 px
 * qui deborde VERS L'INTERIEUR, sur la zone de la valeur — qui n'est
 * cliquable ni l'une ni l'autre. Deux raisons a ce sens :
 *
 * - le conteneur est `overflow-hidden` (il l'etait deja, pour ses coins
 *   arrondis) : une extension vers l'exterieur serait rognee, donc morte ;
 * - les deux extensions mangent 8 px chacune dans une zone centrale qui en
 *   fait au moins 24 — elles ne se rencontrent jamais.
 */
export default function Stepper({
  onIncrement,
  onDecrement,
  incrementDisabled,
  decrementDisabled,
  incrementLabel = "Augmenter",
  decrementLabel = "Diminuer",
  className = "",
  children,
}: {
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled?: boolean;
  decrementDisabled?: boolean;
  incrementLabel?: string;
  decrementLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mech flex flex-col overflow-hidden rounded-lg border-2 border-edge bg-panel-sunken text-ink ${className}`}>
      <button
        type="button"
        disabled={incrementDisabled}
        onClick={onIncrement}
        title={incrementLabel}
        className={`relative flex h-4 w-full shrink-0 items-center justify-center ${TAILLE_GLYPHE} leading-none text-ink-muted transition-colors after:absolute after:inset-x-0 after:top-0 after:h-6 after:content-[''] hover:bg-panel-raised hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted`}
      >
        ▲
      </button>
      <div className="flex items-center justify-center py-0.5">{children}</div>
      <button
        type="button"
        disabled={decrementDisabled}
        onClick={onDecrement}
        title={decrementLabel}
        className={`relative flex h-4 w-full shrink-0 items-center justify-center ${TAILLE_GLYPHE} leading-none text-ink-muted transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:content-[''] hover:bg-panel-raised hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted`}
      >
        ▼
      </button>
    </div>
  );
}
