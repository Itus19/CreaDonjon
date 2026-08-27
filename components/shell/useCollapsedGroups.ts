"use client";

import { useEffect, useState } from "react";

/**
 * Etat plie/deplie des categories d'un sommaire (retour utilisateur),
 * memorise en `localStorage` (meme precedent que `RadioWidget.tsx`,
 * "creadonjon:radioStations") — jamais synchronise entre appareils, un
 * simple confort de navigateur comme `mode`/`background` avant leur
 * lecture serveur. `defaultCollapsed` ne s'applique qu'au tout premier
 * rendu (avant que `localStorage` soit lu, juste apres le montage) —
 * une fois une preference memorisee pour cette cle, elle prend le pas.
 */
export function useCollapsedGroups(storageKey: string, defaultCollapsed: string[] = []) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(defaultCollapsed));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de localStorage, disponible seulement cote client, au premier montage
        setCollapsed(new Set(JSON.parse(raw)));
      }
    } catch {
      // Stockage indisponible (navigation privee stricte) : le defaut passe en argument reste applique.
    }
  }, [storageKey]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Rien a faire si le stockage est indisponible : le pli reste actif pour cette session.
      }
      return next;
    });
  }

  return { isCollapsed: (key: string) => collapsed.has(key), toggle };
}
