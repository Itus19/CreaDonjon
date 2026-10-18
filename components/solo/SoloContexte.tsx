"use client";

import { createContext, useContext } from "react";
import type { PendingRequest } from "@/lib/solo/types";
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
 *   la feuille du personnage (un seul sondage, docs/QUOTAS.md) ;
 * - la demande en cours (`demande`) : la fiche la publie à chaque réponse
 *   de son sondage, la barre d'intention la pose dès que le serveur la rend
 *   (`definirDemande`). Le Jeu ne sonde plus `/sheet` lui-même : deux
 *   sondages de la même route toutes les 4 s doublaient la charge ;
 * - `rechargerFiche` : après un geste du Jeu (tour encaissé, conséquence
 *   appliquée), la fiche se recharge tout de suite au lieu d'attendre son
 *   prochain tick. La fiche s'y inscrit (`inscrireRecharge`).
 */
interface SoloContexteValeur {
  replie: boolean;
  jauges: JaugesBande | null;
  publier: (jauges: JaugesBande | null) => void;
  demande: PendingRequest | null;
  definirDemande: (demande: PendingRequest | null) => void;
  rechargerFiche: () => void;
  inscrireRecharge: (recharger: (() => void) | null) => void;
}

const SoloContexte = createContext<SoloContexteValeur>({
  replie: false,
  jauges: null,
  publier: () => {},
  demande: null,
  definirDemande: () => {},
  rechargerFiche: () => {},
  inscrireRecharge: () => {},
});

export const SoloContexteProvider = SoloContexte.Provider;

export function useSoloContexte(): SoloContexteValeur {
  return useContext(SoloContexte);
}
