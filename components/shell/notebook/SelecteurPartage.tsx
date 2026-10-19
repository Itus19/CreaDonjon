"use client";

export type PortePartage = "privee" | "table";

const OPTIONS: { valeur: PortePartage; libelle: string }[] = [
  { valeur: "privee", libelle: "Privée" },
  { valeur: "table", libelle: "La table" },
];

/**
 * Sélecteur « Privée | La table » d'une page de SON cahier (V3.1-42). Une
 * pilule à deux boutons à bascule (`aria-pressed`) : un seul est enfoncé.
 * Ne dit rien de qui peut écrire — c'est la page qui l'affiche, jamais pour
 * la page d'une autre personne.
 */
export default function SelecteurPartage({
  valeur,
  occupe,
  onChange,
}: {
  valeur: PortePartage;
  /** Un geste de partage est en cours : on n'en lance pas un second. */
  occupe: boolean;
  onChange: (valeur: PortePartage) => void;
}) {
  return (
    <span role="group" aria-label="Qui lit cette page" className="inline-flex shrink-0 items-center rounded-full border border-edge bg-panel-sunken p-[3px] text-xs">
      {OPTIONS.map((option) => {
        const actif = option.valeur === valeur;
        return (
          <button
            key={option.valeur}
            type="button"
            aria-pressed={actif}
            disabled={occupe}
            onClick={() => {
              if (!actif) onChange(option.valeur);
            }}
            className={`rounded-full border px-3 py-1 transition-colors disabled:opacity-50 ${
              actif ? "border-edge-strong bg-panel-raised font-semibold text-ink shadow-sm" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {option.libelle}
          </button>
        );
      })}
    </span>
  );
}
