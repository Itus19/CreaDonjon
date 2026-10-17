"use client";

import { createContext, useContext } from "react";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";

/**
 * L'arbre d'entités que le layout a déjà chargé (V3.1-30), mis à disposition
 * de l'écran d'accueil du téléphone (`AccueilLecteur`) pour sa recherche
 * locale : aucune requête de plus, les pages d'accueil ne reçoivent pas
 * l'arbre en props (il vit dans le layout). `null` hors d'un fournisseur.
 */
const ArbreLecteurContext = createContext<EntityTreeGroup[] | null>(null);

export function ArbreLecteurProvider({ tree, children }: { tree: EntityTreeGroup[]; children: React.ReactNode }) {
  return <ArbreLecteurContext.Provider value={tree}>{children}</ArbreLecteurContext.Provider>;
}

export function useArbreLecteur(): EntityTreeGroup[] {
  return useContext(ArbreLecteurContext) ?? [];
}
