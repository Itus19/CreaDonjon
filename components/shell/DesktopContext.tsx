"use client";

import { createContext, useContext } from "react";
import type { WindowRef } from "./windowRefs";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";

export interface PrimaryWindowInfo {
  ref: WindowRef;
  name: string;
  /** Sous-titre affiche dans la barre de titre (type d'entite ou type d'entree de regle). */
  badge: string;
  /** Ou revenir en fermant la fenetre primaire — depend de la section (Monde ou Regles). */
  homeHref: string;
  /**
   * Donnees deja rendues cote serveur pour cette fenetre primaire (audit de
   * performance, retour utilisateur : "rechargement inutile de fiches déjà
   * ouvertes quand on change de side bar") — optionnel, fourni seulement
   * par les fiches entite/regle (les seules dont le contenu depend de
   * `avecData` une fois repliees en fenetre secondaire). Change de section
   * (Monde/Regles/MJ) demonte la primaire ET rend son `ref` "secondaire" sur
   * la nouvelle page (aucune fenetre primaire n'y correspond) : sans ce
   * champ, `DesktopWindowsProvider` n'avait JAMAIS vu cette donnee (le rendu
   * de la primaire passe entierement par le RSC de la page, jamais par
   * `avecData`) et devait la refetcher a vide — un aller-retour perdu ET un
   * "Chargement..." visible pour une fiche pourtant deja affichee l'instant
   * d'avant.
   */
  data?: EntityWindowData | RuleEntryDetail;
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
