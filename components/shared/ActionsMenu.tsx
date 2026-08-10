"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ActionsMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * Menu compact « ⋮ » (actions type Dupliquer/Supprimer regroupees, plutot
 * qu'un bouton de suppression expose en permanence). Meme mecanique de
 * positionnement/portail/fermeture que `Dropdown.tsx`, mais semantique de
 * menu d'actions (pas de valeur courante a afficher).
 */
export default function ActionsMenu({
  items,
  label = "⋮",
  triggerClassName = "rounded-md px-1.5 py-1 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink",
  "aria-label": ariaLabel,
}: {
  items: ActionsMenuItem[];
  /** Contenu du declencheur — par defaut le "⋮" compact ; un libelle explicite ("Exporter") pour les usages ou l'action doit rester decouvrable. */
  label?: string;
  triggerClassName?: string;
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
      const estimatedHeight = Math.min(200, items.length * 32 + 8);
      const spaceBelow = window.innerHeight - r.bottom;
      const openUpward = spaceBelow < estimatedHeight && r.top > spaceBelow;
      setRect({
        left: r.right - 160,
        width: 160,
        ...(openUpward ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  }

  function select(item: ActionsMenuItem) {
    setOpen(false);
    item.onSelect();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
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
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => select(item)}
                className={`block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                  item.danger ? "text-danger" : "text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
