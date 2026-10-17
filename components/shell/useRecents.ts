"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ajouterRecent,
  cleRecents,
  CLE_DERNIERE_VISITE,
  lireDerniereVisite,
  lireRecents,
  type DerniereVisite,
  type ElementRecent,
  type EspaceRecents,
} from "@/lib/ui/recents";

/**
 * Fiches consultées récemment (V3.1-30, ADR 0036 §4) : lecture et écriture de
 * la liste dans `localStorage`, sans aucun appel réseau.
 *
 * Magasin externe (`useSyncExternalStore`, comme `useRailReplie` dans
 * `Rail.tsx`) : le serveur et le premier rendu du navigateur voient la même
 * liste vide, puis la vraie valeur arrive sans passer par un effet. Une fiche
 * enregistrée dans un composant met à jour tous les autres qui lisent la liste
 * (accueil, feuille ☰).
 *
 * Stockage bloqué (navigation privée stricte) : la liste reste vide et rien ne
 * casse ; un avertissement, une seule fois, pour ne pas se taire en développement.
 */
const abonnes = new Set<() => void>();
let avertiLecture = false;
let avertiEcriture = false;

function abonner(rappel: () => void): () => void {
  abonnes.add(rappel);
  // Un autre onglet qui ouvre une fiche : celui-ci suit.
  window.addEventListener("storage", rappel);
  return () => {
    abonnes.delete(rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Valeur brute (chaîne), donc stable d'un rendu à l'autre tant que rien n'est écrit. */
function lireBrut(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch (erreur) {
    if (!avertiLecture) console.warn("Lecture des fiches récentes impossible", erreur);
    avertiLecture = true;
    return null;
  }
}

/** Ajoute (ou remonte) une fiche en tête de la liste du monde pour cet espace. */
export function enregistrerRecent(worldSlug: string, espace: EspaceRecents, element: ElementRecent): void {
  const cle = cleRecents(worldSlug, espace);
  try {
    const suivante = ajouterRecent(lireRecents(lireBrut(cle)), element);
    window.localStorage.setItem(cle, JSON.stringify(suivante));
    // V3.1-35 : la même visite devient « Reprendre » sur l'accueil.
    const visite: DerniereVisite = { ...element, worldSlug, quand: new Date().toISOString() };
    window.localStorage.setItem(CLE_DERNIERE_VISITE, JSON.stringify(visite));
  } catch (erreur) {
    if (!avertiEcriture) console.warn("Enregistrement des fiches récentes impossible", erreur);
    avertiEcriture = true;
    return;
  }
  abonnes.forEach((rappel) => rappel());
}

/** La liste des fiches récentes de ce monde pour cet espace (vide avant le montage et si le stockage est bloqué). */
export function useRecents(worldSlug: string, espace: EspaceRecents): ElementRecent[] {
  const cle = cleRecents(worldSlug, espace);
  const brut = useSyncExternalStore(
    abonner,
    useCallback(() => lireBrut(cle), [cle]),
    () => null
  );
  return useMemo(() => lireRecents(brut), [brut]);
}

/** La dernière fiche ouverte, tous mondes confondus (V3.1-35, « Reprendre ») ; `null` si rien n'est mémorisé. */
export function useDerniereVisite(): DerniereVisite | null {
  const brut = useSyncExternalStore(
    abonner,
    useCallback(() => lireBrut(CLE_DERNIERE_VISITE), []),
    () => null
  );
  return useMemo(() => lireDerniereVisite(brut), [brut]);
}
