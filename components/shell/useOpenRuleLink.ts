"use client";

import { useDesktop } from "./DesktopContext";
import { windowHref } from "./windowRefs";

/**
 * Miroir de `useOpenEntityLink` (ADR-0011) pour une entree de regle : un
 * clic normal ouvre en fenetre, ctrl/cmd/molette laissent le navigateur
 * ouvrir un nouvel onglet normalement. `renvoi` : le lien est un renvoi dans
 * une fiche (V3.1-95), qui s'ouvre en panneau quand la fenetre est etroite.
 */
export function useOpenRuleLink(worldSlug: string, key: string, options?: { renvoi?: boolean }) {
  const desktop = useDesktop();

  return {
    href: windowHref(worldSlug, { kind: "rule", key }),
    onClick: (e: React.MouseEvent) => {
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      // Un renvoi (V3.1-95) passe par le panneau de la fenetre etroite ; un lien du sommaire, non.
      if (options?.renvoi) desktop.ouvrirRenvoi({ kind: "rule", key });
      else desktop.openRef({ kind: "rule", key });
    },
  };
}
