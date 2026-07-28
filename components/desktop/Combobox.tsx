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
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()));

  function openList() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
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
            style={{ top: rect.top, left: rect.left, minWidth: rect.width }}
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
