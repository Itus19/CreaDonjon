"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

export interface AnnonceAffichee {
  texte: string;
  /** Présent : l'annonce propose « Annuler ». */
  annuler?: () => void;
}

const AnnonceContext = createContext<
  ((annonce: AnnonceAffichee) => void) | null
>(null);

/** Délai avant que l'annonce ne s'efface d'elle-même. */
const DUREE_MS = 10000;

/**
 * V3.1-64 — l'annonce discrète en bas de la fiche (« Rumeurs de Phandaline » :
 * visible par le MJ seul. + « Annuler »). Aucun composant d'annonce n'existait
 * (le catalogue n'a que `ConfirmDialog`, bloquant) : celui-ci est créé une fois
 * et sert toutes les pastilles de la fiche. Une nouvelle annonce remplace la
 * précédente ; `aria-live="polite"` pour les lecteurs d'écran.
 */
export function AnnonceVisibiliteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("fiche.annonce");
  const [annonce, setAnnonce] = useState<AnnonceAffichee | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effacer = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    setAnnonce(null);
  }, []);

  const annoncer = useCallback(
    (a: AnnonceAffichee) => {
      if (minuteur.current) clearTimeout(minuteur.current);
      setAnnonce(a);
      minuteur.current = setTimeout(effacer, DUREE_MS);
    },
    [effacer],
  );

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  return (
    <AnnonceContext.Provider value={annoncer}>
      {children}
      <div
        aria-live="polite"
        className="sticky bottom-3 z-20 mt-3 empty:hidden"
      >
        {annonce && (
          <div className="flex items-center gap-3 rounded-xl border border-success/45 bg-panel-raised px-3 py-2 text-xs text-success backdrop-blur-[var(--blur)]">
            <span className="min-w-0 flex-1">{annonce.texte}</span>
            {annonce.annuler && (
              <button
                type="button"
                onClick={() => {
                  const annuler = annonce.annuler;
                  effacer();
                  annuler?.();
                }}
                className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel"
              >
                {t("annuler")}
              </button>
            )}
            <button
              type="button"
              onClick={effacer}
              aria-label={t("fermer")}
              className="shrink-0 rounded-md px-1.5 text-ink-muted transition-colors hover:text-ink"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </AnnonceContext.Provider>
  );
}

/** `null` hors d'un `AnnonceVisibiliteProvider` : la pastille change alors la visibilité sans rien annoncer. */
export function useAnnoncer(): ((annonce: AnnonceAffichee) => void) | null {
  return useContext(AnnonceContext);
}
