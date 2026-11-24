"use client";

import { useEffect, useRef } from "react";

/**
 * Le jeu à distance (ADR 0103) — les nouveautés se voient sans courriel ni
 * notification système (décision de l'auteur, 18 nov.) :
 * - le titre de l'onglet : « (2) CreaDonjon » ;
 * - un point rouge sur l'icône de l'onglet ;
 * - la pastille de l'app installée (`navigator.setAppBadge`), là où le
 *   navigateur la propose.
 * Tout revient à l'état d'origine quand il n'y a plus rien de neuf, et au
 * démontage de l'écran.
 */
export function useSignalOnglet(nouveaux: number) {
  const titreOrigine = useRef<string | null>(null);
  const iconeOrigine = useRef<string | null>(null);

  useEffect(() => {
    if (titreOrigine.current === null) titreOrigine.current = document.title.replace(/^\(\d+\)\s*/, "");
    const lien = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (lien && iconeOrigine.current === null) iconeOrigine.current = lien.href;

    document.title = nouveaux > 0 ? `(${nouveaux}) ${titreOrigine.current}` : titreOrigine.current;

    const badge = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    const pastille = nouveaux > 0 ? badge.setAppBadge?.(nouveaux) : badge.clearAppBadge?.();
    pastille?.catch((e: unknown) => console.error("Pastille de l'app indisponible", e));

    if (!lien || !iconeOrigine.current) return;
    if (nouveaux === 0) {
      lien.href = iconeOrigine.current;
      return;
    }
    let annule = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (annule) return;
      const toile = document.createElement("canvas");
      toile.width = 64;
      toile.height = 64;
      const ctx = toile.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, 64, 64);
      ctx.beginPath();
      ctx.arc(48, 16, 14, 0, 2 * Math.PI);
      // Le jeton de danger, lu dans la feuille : une toile ne connaît pas les classes.
      ctx.fillStyle = "red";
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "red";
      ctx.fill();
      try {
        lien.href = toile.toDataURL("image/png");
      } catch (e) {
        // Une icône d'une autre origine « salit » la toile : le titre suffit alors.
        console.error("Point sur l'icône de l'onglet impossible", e);
      }
    };
    image.onerror = (e) => console.error("Icône de l'onglet illisible", e);
    image.src = iconeOrigine.current;
    return () => {
      annule = true;
    };
  }, [nouveaux]);

  useEffect(
    () => () => {
      if (titreOrigine.current !== null) document.title = titreOrigine.current;
      const lien = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (lien && iconeOrigine.current) lien.href = iconeOrigine.current;
      const badge = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      badge.clearAppBadge?.().catch((e: unknown) => console.error("Pastille de l'app indisponible", e));
    },
    []
  );
}
