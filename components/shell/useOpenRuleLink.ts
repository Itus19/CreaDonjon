"use client";

import { useDesktop } from "./DesktopContext";
import { windowHref } from "./windowRefs";

/**
 * Miroir de `useOpenEntityLink` (ADR-0011) pour une entree de regle : un
 * clic normal ouvre en fenetre, ctrl/cmd/molette laissent le navigateur
 * ouvrir un nouvel onglet normalement.
 */
export function useOpenRuleLink(worldSlug: string, key: string) {
  const desktop = useDesktop();

  return {
    href: windowHref(worldSlug, { kind: "rule", key }),
    onClick: (e: React.MouseEvent) => {
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      desktop.openRef({ kind: "rule", key });
    },
  };
}
