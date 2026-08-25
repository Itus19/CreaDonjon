"use client";

import { useDesktop } from "./DesktopContext";

/**
 * Un clic normal ouvre en fenetre (ADR-0006) ; ctrl/cmd/molette laissent
 * le navigateur ouvrir un nouvel onglet normalement (l'attribut `href`
 * reste correct dans les deux cas).
 */
export function useOpenEntityLink(worldSlug: string, slug: string) {
  const desktop = useDesktop();

  return {
    href: `/m/${worldSlug}/f/${slug}`,
    onClick: (e: React.MouseEvent) => {
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      desktop.openRef({ kind: "entity", key: slug });
    },
  };
}
