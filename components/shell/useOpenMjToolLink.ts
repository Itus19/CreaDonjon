"use client";

import { useDesktop } from "./DesktopContext";
import { mjToolHref, type MjToolKey } from "./windowRefs";

/**
 * Meme motif que `useOpenEntityLink`/`useOpenRuleLink` (ADR-0006, retour
 * utilisateur V2-M7 suite) : un clic normal sur un outil MJ de la sidebar
 * ouvre/focus sa fenetre plutot que de naviguer en plein cadre — jamais de
 * fermeture des autres fenetres deja ouvertes (fiche, regle, autre outil
 * MJ). ctrl/cmd/molette laissent le navigateur ouvrir un nouvel onglet.
 */
export function useOpenMjToolLink(worldSlug: string, key: MjToolKey) {
  const desktop = useDesktop();
  const href = mjToolHref(worldSlug, key);

  return {
    href,
    onClick: (e: React.MouseEvent) => {
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      desktop.openRef({ kind: "mj", key });
    },
  };
}
