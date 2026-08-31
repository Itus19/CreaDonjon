"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import BackgroundPicker, { type BackgroundSelection } from "./BackgroundPicker";

const MODES = ["dark", "dim", "soft", "light"] as const;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000`;
}

/**
 * Personnalisation (retour utilisateur : "supprimer le bouton de reglages,
 * deplacer ses options ailleurs") — extrait tel quel de l'ancien onglet
 * "Thème" de `SettingsMenu.tsx` (meme technique cookie + ecriture DOM
 * directe, aucun rechargement) : outil MJ desormais, jamais un modal
 * flottant au-dessus de toutes les pages.
 */
export default function PersonnalisationPanel({
  currentMode,
  currentContrast,
  currentBackgroundRef,
  currentBackgroundAvailableModes,
  currentBgBlur,
}: {
  currentMode: string;
  currentContrast: string;
  currentBackgroundRef: string;
  currentBackgroundAvailableModes: string[];
  currentBgBlur: number;
}) {
  const t = useTranslations("settings");
  const [mode, setMode] = useState(currentMode);
  const [contrast, setContrast] = useState(currentContrast);
  const [backgroundAvailableModes, setBackgroundAvailableModes] = useState(currentBackgroundAvailableModes);
  const [bgBlur, setBgBlur] = useState(currentBgBlur);

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

  function toggleContrast() {
    setContrast((c) => (c === "high" ? "off" : "high"));
  }

  /**
   * Applique une selection de fond d'ecran (V2-G4 reformule) : `--h`/`--c`
   * vivent sur `<html>` et `--bg-image` sur `.app-backdrop`, un frere de ce
   * composant dans `app/layout.tsx`, jamais un ancetre React de celui-ci —
   * d'ou la selection par attribut plutot qu'une ref.
   */
  function handleBackgroundSelection(selection: BackgroundSelection) {
    document.documentElement.style.setProperty("--h", String(selection.hue));
    document.documentElement.style.setProperty("--c", String(selection.chroma));
    document.querySelector<HTMLElement>(".app-backdrop")?.style.setProperty("--bg-image", `url("${selection.backdropUrl}")`);
    setBackgroundAvailableModes(selection.availableModes);
    if (!selection.availableModes.includes(mode)) {
      const fallbackMode = selection.availableModes[0];
      if (fallbackMode) setMode(fallbackMode);
    }
    setCookie("background", selection.ref);
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--bg-blur", `${bgBlur}px`);
    setCookie("bgBlur", String(bgBlur));
  }, [bgBlur]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="block-title text-lg">{t("theme.titre")}</h1>
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => {
            const disabled = !backgroundAvailableModes.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={disabled}
                title={disabled ? "Ce fond ne permet pas ce mode de façon lisible" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                  mode === m ? "ring-1 ring-accent" : ""
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border border-edge mode-swatch-${m}`}>
                  <span className={`h-1.5 w-1.5 rounded-full mode-swatch-${m}-accent`} />
                </span>
                {t(`theme.${m}`)}
              </button>
            );
          })}
        </div>
        <BackgroundPicker currentRef={currentBackgroundRef} onSelectionChange={handleBackgroundSelection} />
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Flou du fond ({bgBlur}px)
          <input
            type="range"
            min={0}
            max={40}
            step={2}
            value={bgBlur}
            onChange={(e) => setBgBlur(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        <button
          type="button"
          onClick={toggleContrast}
          className={`self-start rounded-md border border-edge px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-panel ${
            contrast === "high" ? "text-accent" : ""
          }`}
        >
          {t("theme.contrasteEleve")} {contrast === "high" ? "✓" : ""}
        </button>
      </section>
    </div>
  );
}
