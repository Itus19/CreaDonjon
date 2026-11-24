"use client";

import { createContext, useContext, useState } from "react";

/**
 * AG-10 — la campagne du monde se sert-elle du niveau de visibilité
 * « Joueurs » ? Lu par le layout du monde avec la campagne (docs/CABLAGE.md,
 * C1 : aucune requête de plus) et partagé par contexte (C2). L'interrupteur
 * de Gestion de campagne met la valeur à jour ici après l'écriture (C5 :
 * pas de rechargement). Sans fournisseur (écran hors d'un monde), le niveau
 * reste proposé. Indication d'interface seulement : le filtrage serveur ne
 * change pas.
 */
const NiveauJoueursContext = createContext<{ actif: boolean; changer: (actif: boolean) => void }>({ actif: true, changer: () => {} });

export default function NiveauJoueursProvider({ actif: initial, children }: { actif: boolean; children: React.ReactNode }) {
  const [actif, changer] = useState(initial);
  return <NiveauJoueursContext.Provider value={{ actif, changer }}>{children}</NiveauJoueursContext.Provider>;
}

export function useNiveauJoueurs(): boolean {
  return useContext(NiveauJoueursContext).actif;
}

/** Pour l'interrupteur de Gestion de campagne, après une écriture réussie. */
export function useChangerNiveauJoueurs(): (actif: boolean) => void {
  return useContext(NiveauJoueursContext).changer;
}
