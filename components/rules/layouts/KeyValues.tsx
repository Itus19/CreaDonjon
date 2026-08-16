import type { ReactNode } from "react";

/**
 * Mise en page `key_values` (specs/regles-blocs.md §4) : paires
 * etiquette/valeur en cartes courtes, trois par ligne a partir de `sm`.
 * `fullWidth` (V1-D7, sur retour utilisateur — bloc `background`, don sur
 * sa propre ligne) etire une paire sur toute la largeur de la grille
 * plutot que de partager sa colonne : utile pour une valeur en texte long
 * a cote de faits courts, sans en faire un layout separe (extension
 * generique du composant partage, pas une exception par bloc).
 */
export default function KeyValues({ items }: { items: { label: string; value: ReactNode; fullWidth?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {items.map((item, i) => (
        <div key={i} className={`flex flex-col gap-0.5 ${item.fullWidth ? "col-span-2 sm:col-span-3" : ""}`}>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{item.label}</dt>
          <dd className="text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
