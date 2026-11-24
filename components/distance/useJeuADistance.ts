"use client";

import { useEffect, useState } from "react";
import type { PlayStyle } from "@/src/core/remote/feed";

/**
 * ADR 0103 — la façon de jouer change dans Gestion de campagne ; la barre du
 * MJ, rendue par le layout, ne se relit pas à la navigation. Plutôt qu'un
 * `router.refresh()` qui recalculerait tout l'écran (CABLAGE C5), le panneau
 * annonce le changement dans la page et la barre l'adopte aussitôt.
 */
const EVENEMENT = "creadonjon:facon-de-jouer";

export function annoncerFaconDeJouer(playStyle: PlayStyle) {
  window.dispatchEvent(new CustomEvent<PlayStyle>(EVENEMENT, { detail: playStyle }));
}

/** Le jeu à distance est-il ouvert : la valeur du layout, puis la dernière annoncée dans la page. */
export function useJeuADistance(initial: boolean): boolean {
  const [annonce, setAnnonce] = useState<boolean | null>(null);
  useEffect(() => {
    const ecouter = (e: Event) => setAnnonce((e as CustomEvent<PlayStyle>).detail !== "table");
    window.addEventListener(EVENEMENT, ecouter);
    return () => window.removeEventListener(EVENEMENT, ecouter);
  }, []);
  return annonce ?? initial;
}
