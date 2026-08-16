import type { ReactNode } from "react";

/**
 * Mise en page `key_values` (specs/regles-blocs.md §4) : paires
 * etiquette/valeur en cartes courtes, trois par ligne a partir de `sm`.
 * `fullWidth` (V1-D7, sur retour utilisateur — bloc `background`, don sur
 * sa propre ligne) etire une paire sur toute la largeur de la grille
 * plutot que de partager sa colonne : utile pour une valeur en texte long
 * a cote de faits courts, sans en faire un layout separe (extension
 * generique du composant partage, pas une exception par bloc).
 *
 * Hierarchie etiquette/valeur inversee (V1-D7, sur retour utilisateur) :
 * l'etiquette (ce qu'est la donnee) devient l'element dominant — plus
 * grande, plus foncee — et la valeur (la donnee elle-meme) plus discrete.
 * Changement partage par tous les blocs `key_values` (weapon/armor/
 * spell_casting/...), pas seulement `background` : coherence voulue plutot
 * qu'une exception locale.
 */
export default function KeyValues({ items }: { items: { label: string; value: ReactNode; fullWidth?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
      {items.map((item, i) => (
        <div key={i} className={`flex flex-col gap-1 ${item.fullWidth ? "col-span-2 sm:col-span-3" : ""}`}>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink">{item.label}</dt>
          <dd className="text-xs text-ink-muted">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
