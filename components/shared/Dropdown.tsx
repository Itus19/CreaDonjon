"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Style du declencheur (docs/CHARTE-UI.md §3, "Liste deroulante") —
 * TOUJOURS applique, jamais remplace par `className`. C'est ce qui garantit
 * qu'un appel ne peut plus produire un bouton nu, c'est-a-dire gris-blanc
 * natif (retour utilisateur : "les boutons-listes toujours blancs").
 *
 * `inline-flex items-center` corrige un vrai defaut du style d'origine, qui
 * n'en avait pas : le libelle porte `flex-1 truncate` et le chevron
 * `shrink-0`, deux classes sans aucun effet dans un `<button>` reste en
 * `inline-block` par defaut. Le troncage d'un libelle long ne fonctionnait
 * donc pas pour les appels qui ne passaient pas leur propre style.
 */
const TRIGGER_BASE =
  "inline-flex items-center gap-1 rounded-md border border-edge bg-transparent text-ink outline-none transition-colors hover:bg-panel-raised disabled:opacity-50";

/**
 * Deux tailles, fermees — la prop que docs/CHARTE-UI.md §3 prescrit
 * lorsque l'apparence par defaut ne convient pas ("c'est le composant
 * qu'on corrige, jamais l'appel"). `md` est le gabarit des champs de
 * formulaire du depot (`px-2 py-1.5 text-sm`, cf. la recette "Champ de
 * saisie"), `sm` celui des barres d'outils denses.
 */
const TRIGGER_SIZE = {
  sm: "px-2 py-1 text-xs",
  md: "px-2 py-1.5 text-sm",
} as const;

/**
 * Remplace `<select>` (V0-06b) : memes jetons que le reste de la coquille,
 * un menu en portail pour ne jamais etre coupe par un conteneur au scroll
 * (reprend le pattern de l'ancienne application, `master`,
 * components/desktop/Dropdown.tsx).
 */
export default function Dropdown({
  value,
  options,
  onChange,
  className,
  triggerClassName,
  size = "sm",
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /**
   * MISE EN PAGE uniquement — largeur, `flex-1`, `shrink-0`, marges.
   * S'AJOUTE a `TRIGGER_BASE`, ne le remplace jamais : un appel qui ne
   * passe qu'une largeur garde donc bordure, fond et couleur de texte.
   * Ne pas y mettre de couleur, de bordure ni de rayon — ils entreraient
   * en conflit avec le style de base, et c'est l'ordre des utilitaires
   * dans la feuille generee qui trancherait, pas celui ecrit ici.
   */
  className?: string;
  /**
   * HERITE — remplace ENTIEREMENT le style du declencheur, y compris
   * bordure, fond et couleur. C'etait le comportement de `className` avant
   * (V2, correctif de charte) : les appels qui composaient deja leur propre
   * style ont ete renommes ici tels quels, a l'apparence strictement
   * inchangee. Ne pas en ecrire de nouveau — le besoin d'une variante se
   * traite en ajoutant une prop fermee a ce composant (une taille, une
   * forme), jamais en redonnant a chaque appelant la charge de tout
   * redecrire.
   */
  triggerClassName?: string;
  /** `sm` (defaut) pour une barre d'outils dense, `md` pour un champ de formulaire. */
  size?: keyof typeof TRIGGER_SIZE;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(240, options.length * 32 + 8);
      const spaceBelow = window.innerHeight - r.bottom;
      const openUpward = spaceBelow < estimatedHeight && r.top > spaceBelow;
      setRect({
        left: r.left,
        width: r.width,
        ...(openUpward ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current?.label ?? value}
        className={triggerClassName ?? `${TRIGGER_BASE} ${TRIGGER_SIZE[size]}${className ? ` ${className}` : ""}`}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? value}</span>
        <span className="shrink-0 text-ink-muted">▾</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="fixed z-[1000] max-h-60 overflow-auto rounded-md border border-edge-strong bg-panel-raised shadow-2xl"
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, minWidth: rect.width }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                // Empeche le mousedown de deplacer le focus DOM vers ce
                // bouton, qui vit dans un portail hors du conteneur du bloc
                // (`document.body`) : sans ce garde, le focus quittait le
                // bloc AVANT que `onClick` n'applique la selection, ce qui
                // declenchait la sauvegarde au blur (EntityBlocks.tsx,
                // handleBlockBlur) avec l'ETAT PRECEDENT — la valeur tout
                // juste choisie disparaissait silencieusement au premier
                // rechargement, sans qu'aucun message ne le signale.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(opt.value)}
                className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                  opt.value === value ? "text-accent" : "text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
