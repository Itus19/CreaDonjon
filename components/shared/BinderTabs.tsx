"use client";

import { useRef } from "react";

export interface BinderTabItem<T extends string> {
  value: T;
  label: string;
}

/**
 * Onglets en intercalaire de classeur (ADR 0026) — la seconde des deux
 * presentations autorisees, pour quand les onglets SONT la page : panneau
 * pleine largeur, un contenu propre par onglet, et l'actif qui s'ouvre
 * visiblement sur lui. Pour un filtre a l'interieur d'un panneau, c'est
 * `Tabs.tsx` (bascule segmentee), jamais celui-ci.
 *
 * Extrait de `PlayableCharacterSheet.tsx` a apparence strictement
 * inchangee (V2.1-24, lot 1), ou il etait ne d'un retour joueur : "les
 * onglets ne sont pas tres visibles" — un souligne de 2 px etait le seul
 * signal, et rien ne rattachait l'onglet a sa page.
 *
 * La ligne du haut n'est PAS une bordure continue qu'on repeindrait sous
 * l'onglet actif : elle est composee par le bord bas de chaque onglet
 * INACTIF et du remplissage souple. L'onglet actif n'a pas de bord bas —
 * c'est la l'ouverture du classeur. Aucun chevauchement ni decalage
 * negatif, donc rien a corriger la ou `--panel-raised` est translucide :
 * l'onglet actif et la page composent leur alpha sur le meme fond, cote a
 * cote, jamais l'un sur l'autre.
 *
 * Les coins hauts arrondis suffisent a separer deux onglets inactifs
 * jointifs — une marge entre eux trouerait la ligne du haut.
 *
 * Le panneau reste chez l'appelant : seule la rangee d'onglets vit ici.
 * C'est lui qui porte `rounded-b-lg border-2 border-t-0 border-edge-strong`,
 * parce que son contenu et son rembourrage ne se generalisent pas.
 */
export default function BinderTabs<T extends string>({
  value,
  items,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  items: BinderTabItem<T>[];
  onChange: (value: T) => void;
  /** Mise en page uniquement — largeur, marge. Ni couleur, ni bordure, ni rayon (CHARTE-UI §3). */
  className?: string;
  /** Obligatoire, et le type l'impose : une liste d'onglets sans nom accessible s'annonce sans dire de quoi ses onglets sont les vues. Meme regle que `Dropdown`/`Checkbox`. */
  "aria-label": string;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex (motif ARIA des onglets), repris de `Tabs.tsx` : UN
  // seul onglet dans l'ordre de tabulation, les fleches circulent entre
  // eux. Sans ca, Tab traverse les cinq onglets un a un avant d'atteindre
  // le contenu — c'etait le cas de la fiche jouable avant l'extraction.
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    let next = -1;
    if (delta !== 0) next = (index + delta + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    // Le focus suit la selection : c'est le comportement attendu d'un
    // onglet, et sans lui les fleches suivantes repartiraient du mauvais
    // index. Par refs et non par `parentElement.children` : la rangee
    // porte un `<span>` de remplissage en dernier enfant.
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-end overflow-x-auto text-xs${className ? ` ${className}` : ""}`}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(item.value)}
            className={`shrink-0 rounded-t-lg border-2 px-3.5 transition-colors ${
              active
                ? "border-edge-strong border-b-transparent bg-panel-raised pb-2 pt-2.5 font-medium text-ink shadow-[inset_0_3px_0_0_var(--accent)]"
                : "border-transparent border-b-edge-strong bg-panel-sunken py-2 text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
      {/* Prolonge la ligne du haut jusqu'au bord droit de la page. */}
      <span aria-hidden="true" className="min-w-4 flex-1 self-stretch border-b-2 border-edge-strong" />
    </div>
  );
}
