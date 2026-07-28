"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Combobox({
  defaultValue,
  suggestions,
  onCommit,
  placeholder,
  name,
  required,
  className,
}: {
  defaultValue: string;
  suggestions: string[];
  onCommit?: (value: string) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()));

  function openList() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(192, filtered.length * 32 + 8);
      const spaceBelow = window.innerHeight - r.bottom;
      const openUpward = spaceBelow < estimatedHeight && r.top > spaceBelow;
      setRect({
        left: r.left,
        width: r.width,
        ...(openUpward ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    }
    setOpen(true);
  }

  function commit(v: string) {
    setValue(v);
    setOpen(false);
    onCommit?.(v);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          openList();
        }}
        onFocus={openList}
        onBlur={() => {
          setOpen(false);
          onCommit?.(value);
        }}
        className={className}
      />
      {open &&
        rect &&
        filtered.length > 0 &&
        createPortal(
          <div
            className="fixed z-[1000] max-h-48 overflow-auto rounded-md border border-border bg-surface shadow-2xl"
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, minWidth: rect.width }}
          >
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(s)}
                className="block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-hover"
              >
                {s}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
