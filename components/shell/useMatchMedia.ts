"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Seuil sous lequel le bureau a fenetres n'existe pas (V3-R2) — `md` de
 * Tailwind. La valeur etait dupliquee en dur (`MOBILE_BREAKPOINT = 768`)
 * dans `WindowsDesktop.tsx` ET `AvecWindowsLayer.tsx`, deux fichiers qui
 * doivent imperativement basculer ensemble : une fenetre primaire repliee
 * en panneau pendant que la couche secondaire se croit encore sur grand
 * ecran donnait un ecran incoherent. Un seul endroit, donc.
 *
 * `767.98px` et non `767px` : l'ancien test etait `window.innerWidth < 768`,
 * vrai a 767.5 px (zoom navigateur, barre de defilement sur certaines
 * plateformes) la ou `max-width: 767px` serait faux. La decimale reproduit
 * exactement l'ancien comportement au lieu de le decaler d'un demi-pixel.
 */
export const WINDOWS_MOBILE_QUERY = "(max-width: 767.98px)";

/**
 * `useSyncExternalStore` (pas `useState` + `useEffect`) : `window.matchMedia`
 * est un etat externe au rendu React, c'est exactement ce que ce hook est
 * fait pour synchroniser — et il evite d'appeler un `setState` dans un effet
 * (`react-hooks/set-state-in-effect`). Le motif vient de `DiceRollPanel.tsx`,
 * qui l'appliquait deja ; V3-R2 l'extrait pour que les trois appelants
 * partagent le meme mecanisme.
 *
 * Ce que ca change concretement sur telephone : avec `useState(false)` +
 * `useEffect`, le premier rendu client SUPPOSAIT un grand ecran, montait
 * l'arbre du bureau a fenetres, puis le jetait quand l'effet s'executait —
 * du travail integralement perdu sur l'appareil le plus lent. Ici la valeur
 * est juste des le premier rendu client.
 */
export function useMatchMedia(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Le serveur ne connait pas la largeur de l'ecran : il rend la version
 * grand ecran, comme avant ce ticket. React reconcilie avec la vraie valeur
 * des l'hydratation, sans passer par un effet.
 */
function getServerSnapshot(): boolean {
  return false;
}
