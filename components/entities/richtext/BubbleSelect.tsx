"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Selecteur compact pour la bulle d'edition. Volontairement PAS un portail
 * (contrairement a `components/shared/Dropdown.tsx`) : la bulle Tiptap vit
 * dans le sous-arbre DOM du bloc, et un menu porte vers `document.body`
 * deplacerait le focus hors de ce sous-arbre au clic sur une option,
 * declenchant une sauvegarde prematuree du bloc (le blur du conteneur ne
 * verrait plus l'option comme un descendant). Rester dans l'arbre local
 * evite le probleme plutot que de le contourner.
 */
export default function BubbleSelect({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-xs text-ink transition-colors hover:bg-panel"
      >
        {current?.label ?? value} <span className="text-ink-muted">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-10 mt-1 max-h-60 min-w-[9rem] overflow-auto rounded-md border border-edge-strong bg-panel-raised shadow-2xl"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                opt.value === value ? "text-accent" : "text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
