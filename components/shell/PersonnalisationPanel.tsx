"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { MODES_APPARENCE as MODES, modeApresChoixDeFond } from "@/lib/ui/apparence";
import BackgroundPicker, { type BackgroundSelection } from "./BackgroundPicker";

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
  /** V3.1-58 : la bascule de mode imposée par un fond est dite, jamais muette. */
  const [annonce, setAnnonce] = useState<string | null>(null);

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
    const suite = modeApresChoixDeFond(mode, selection.availableModes);
    setMode(suite.mode);
    setAnnonce(suite.bascule ? t("theme.bascule", { fond: selection.libelle, apres: t(`theme.${suite.mode}`) }) : null);
    setCookie("background", selection.ref);
  }

  useEffect(() => {
    document.documentElement.style.setProperty("--bg-blur", `${bgBlur}px`);
    setCookie("bgBlur", String(bgBlur));
  }, [bgBlur]);

  const modeItems = MODES.map((m) => {
    const permis = backgroundAvailableModes.includes(m);
    return { value: m, label: t(`theme.${m}`), disabled: !permis, title: permis ? undefined : t("theme.modeIllisible") };
  });
  const contrasteActif = contrast === "high";

  return (
    <div className="flex flex-col gap-3">
      {/* La barre : jamais de `basis-full` sur le flou en colonne (il prendrait toute la hauteur). */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-edge bg-panel px-3 py-2.5 md:px-3.5">
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-4">
          <div className="md:w-[420px] md:max-w-full">
            <Tabs
              value={mode as (typeof MODES)[number]}
              items={modeItems}
              onChange={(m) => {
                setMode(m);
                setAnnonce(null);
              }}
              aria-label={t("theme.modes")}
              className="w-full max-md:[&_button]:px-1"
            />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={contrasteActif}
            onClick={toggleContrast}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col text-sm text-ink">
              {t("theme.contrasteEleve")}
              <small className="text-xs text-ink-muted">{t("theme.contrasteAide")}</small>
            </span>
            <span className={`relative h-[18px] w-[30px] shrink-0 rounded-full border transition-colors motion-reduce:transition-none ${contrasteActif ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all motion-reduce:transition-none ${contrasteActif ? "left-[15px]" : "left-0.5"}`} />
            </span>
          </button>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <span className="shrink-0">{t("theme.flou")}</span>
          <input
            type="range"
            min={0}
            max={40}
            step={2}
            value={bgBlur}
            onChange={(e) => setBgBlur(Number(e.target.value))}
            className="min-w-0 flex-1 accent-accent"
          />
          <b className="w-12 shrink-0 text-right font-medium tabular-nums">{t("theme.flouValeur", { valeur: bgBlur })}</b>
        </label>
      </div>
      <p role="status" className="min-h-0 text-xs text-accent empty:hidden">
        {annonce}
      </p>
      <BackgroundPicker
        currentRef={currentBackgroundRef}
        onSelectionChange={handleBackgroundSelection}
      />
      <p className="border-t border-edge pt-2 text-xs leading-snug text-ink-muted">{t("theme.note")}</p>
    </div>
  );
}
