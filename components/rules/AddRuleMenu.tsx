"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export interface AddRuleMenuItem {
  href: string;
  label: string;
}

/**
 * Bouton unique "Ajouter une regle" (retour utilisateur : un seul bouton
 * jaune plutot qu'un par type de regle empile en bas de la barre laterale)
 * — ouvre un menu de choix de type, chaque entree menant vers son propre
 * formulaire dedie (`nouvelle-arme`, `nouvel-historique`, `nouveau-don`...).
 * Meme motif de portail que `Dropdown.tsx` (jamais coupe par le
 * `overflow-y-auto` de la liste de regles au-dessus), mais un menu de
 * navigation plutot qu'un selecteur de valeur : les items sont des liens,
 * pas un `onChange`.
 */
export default function AddRuleMenu({ label, items, onNavigate }: { label: string; items: AddRuleMenuItem[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number; bottom: number } | null>(null);
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
      setRect({ left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="block w-full rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
      >
        {label}
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[1000] overflow-hidden rounded-md border border-edge-strong bg-panel-raised shadow-2xl"
            style={{ bottom: rect.bottom, left: rect.left, minWidth: rect.width }}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="block whitespace-nowrap px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel"
              >
                {item.label}
              </Link>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
