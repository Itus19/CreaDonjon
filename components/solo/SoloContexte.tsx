"use client";

import { createContext, useContext } from "react";
import type { JaugesBande } from "@/lib/ui/solo";

/**
 * V3.1-36 — Ce que la coquille solo (`SoloShell`) et ses colonnes se disent.
 *
 * Les colonnes sont des arbres React voisins, posés par la page serveur : la
 * coquille ne peut pas leur passer de fonction ni de prop calculée. Ce contexte
 * porte les deux seuls échanges nécessaires :
 * - vers la fiche : « tu es repliée en bande » (`replie`, ordinateur seulement) ;
 * - depuis la fiche : ses jauges (`publier`), que la bande du Jeu, sur
 *   téléphone, relit — la fiche reste l'UNIQUE endroit qui charge et sonde
 *   la feuille du personnage (un seul sondage, docs/QUOTAS.md).
 */
interface SoloContexteValeur {
  replie: boolean;
  jauges: JaugesBande | null;
  publier: (jauges: JaugesBande | null) => void;
}

const SoloContexte = createContext<SoloContexteValeur>({ replie: false, jauges: null, publier: () => {} });

export const SoloContexteProvider = SoloContexte.Provider;

export function useSoloContexte(): SoloContexteValeur {
  return useContext(SoloContexte);
}
