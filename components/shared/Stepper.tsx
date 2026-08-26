import type { ReactNode } from "react";

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
        className="flex h-4 w-full shrink-0 items-center justify-center text-[9px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
      >
        ▲
      </button>
      <div className="flex items-center justify-center py-0.5">{children}</div>
      <button
        type="button"
        disabled={decrementDisabled}
        onClick={onDecrement}
        title={decrementLabel}
        className="flex h-4 w-full shrink-0 items-center justify-center text-[9px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
      >
        ▼
      </button>
    </div>
  );
}
