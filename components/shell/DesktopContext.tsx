"use client";

import { createContext, useContext } from "react";

export interface DesktopContextValue {
  /** Ouvre une entite : fenetre supplementaire si une fiche est deja la fenetre primaire, sinon navigation normale. */
  openEntity: (slug: string) => void;
  /** Marqueur pose par la fiche actuellement routee (ADR-0006) — jamais appele pour une fenetre secondaire. */
  registerPrimary: (info: { slug: string; name: string; kind: string } | null) => void;
}

export const DesktopContext = createContext<DesktopContextValue | null>(null);

/** `null` hors du bureau (ne devrait pas arriver dans les pages du monde) : les appelants tombent alors en navigation normale. */
export function useDesktop(): DesktopContextValue | null {
  return useContext(DesktopContext);
}
