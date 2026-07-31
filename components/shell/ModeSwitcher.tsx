"use client";

import { useEffect, useState } from "react";

const MODES = [
  { id: "dark", label: "Sombre" },
  { id: "dim", label: "Demi-sombre" },
  { id: "soft", label: "Demi-clair" },
  { id: "light", label: "Clair" },
] as const;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000`;
}

export default function ModeSwitcher({
  currentMode,
  currentContrast,
}: {
  currentMode: string;
  currentContrast: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(currentMode);
  const [contrast, setContrast] = useState(currentContrast);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    setCookie("mode", mode);
  }, [mode]);

  useEffect(() => {
    if (contrast === "high") {
      document.documentElement.dataset.contrast = "high";
    } else {
      delete document.documentElement.dataset.contrast;
    }
    setCookie("contrast", contrast);
  }, [contrast]);

  function selectMode(id: string) {
    setMode(id);
    setOpen(false);
  }

  function toggleContrast() {
    setContrast((c) => (c === "high" ? "off" : "high"));
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1 rounded-lg border border-edge bg-panel p-2 shadow-xl backdrop-blur-md">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised ${
                mode === m.id ? "ring-1 ring-accent" : ""
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border border-edge mode-swatch-${m.id}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full mode-swatch-${m.id}-accent`} />
              </span>
              {m.label}
            </button>
          ))}
          <button
            onClick={toggleContrast}
            className={`mt-1 rounded-md border-t border-edge px-2 py-1.5 pt-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised ${
              contrast === "high" ? "text-accent" : ""
            }`}
          >
            Contraste élevé {contrast === "high" ? "✓" : ""}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Changer d'apparence"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-panel text-ink shadow-lg transition-colors hover:bg-panel-raised"
      >
        🎨
      </button>
    </div>
  );
}
