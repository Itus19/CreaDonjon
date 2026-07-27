"use client";

import { useState } from "react";

const THEMES = [
  { id: "dark", label: "Sombre", swatch: "#0d1210", swatchAccent: "#c9a24a" },
  { id: "semi-dark", label: "Demi-sombre", swatch: "#241f1a", swatchAccent: "#d1a54e" },
  { id: "semi-light", label: "Demi-clair", swatch: "#cdbfa4", swatchAccent: "#8a5a26" },
  { id: "light", label: "Clair", swatch: "#f6f3ec", swatchAccent: "#9c6b1f" },
];

export default function ThemeSwitcher({ currentTheme }: { currentTheme: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(currentTheme);

  function selectTheme(id: string) {
    document.documentElement.dataset.theme = id;
    document.cookie = `theme=${id}; path=/; max-age=31536000`;
    setTheme(id);
    setOpen(false);
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Changer de thème"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg transition-colors hover:bg-surface-hover"
      >
        🎨
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-xl">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTheme(t.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover ${
                theme === t.id ? "ring-1 ring-accent" : ""
              }`}
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full border border-border"
                style={{ backgroundColor: t.swatch }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: t.swatchAccent }}
                />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
