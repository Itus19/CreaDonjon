"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Dropdown({
  defaultValue,
  options,
  onChange,
  name,
  className,
}: {
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(
    null,
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
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
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
    setValue(v);
    onChange?.(v);
    setOpen(false);
  }

  const current = options.find((o) => o.value === value);

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={
          className ??
          "rounded-md border border-border bg-black/20 px-1.5 py-0.5 text-[10px] text-foreground outline-none"
        }
      >
        {current?.label ?? value} <span className="text-muted">▾</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[1000] max-h-60 overflow-auto rounded-md border border-border bg-surface shadow-2xl"
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, minWidth: rect.width }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => select(opt.value)}
                className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover ${
                  opt.value === value ? "text-accent" : "text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
