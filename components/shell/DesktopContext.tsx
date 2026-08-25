"use client";

import { createContext, useContext } from "react";
import type { WindowRef } from "./windowRefs";

export interface PrimaryWindowInfo {
  ref: WindowRef;
  name: string;
  /** Sous-titre affiche dans la barre de titre (type d'entite ou type d'entree de regle). */
  badge: string;
  /** Ou revenir en fermant la fenetre primaire — depend de la section (Monde ou Regles). */
  homeHref: string;
}

export interface DesktopContextValue {
  /** Ouvre une reference (entite ou regle) : fenetre supplementaire si une fiche est deja la fenetre primaire, sinon navigation normale. */
  openRef: (ref: WindowRef) => void;
  /** Marqueur pose par la fiche actuellement routee (ADR-0011) — jamais appele pour une fenetre secondaire. */
  registerPrimary: (info: PrimaryWindowInfo | null) => void;
}

export const DesktopContext = createContext<DesktopContextValue | null>(null);

/** `null` hors du bureau (ne devrait pas arriver dans les pages du monde) : les appelants tombent alors en navigation normale. */
export function useDesktop(): DesktopContextValue | null {
  return useContext(DesktopContext);
}
