"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
}

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
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
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
        className={
          className ??
          "rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none transition-colors hover:bg-panel-raised"
        }
      >
        {current?.label ?? value} <span className="text-ink-muted">▾</span>
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
