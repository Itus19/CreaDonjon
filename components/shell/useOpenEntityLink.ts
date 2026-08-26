"use client";

import { useDesktop } from "./DesktopContext";

/**
 * Un clic normal ouvre en fenetre (ADR-0006) ; ctrl/cmd/molette laissent
 * le navigateur ouvrir un nouvel onglet normalement (l'attribut `href`
 * reste correct dans les deux cas).
 *
 * `hrefBase` (V2-G2) : la peau « livre » (sommaire public/apercu) reutilise
 * ce meme hook via `EntityTree`, mais pointe vers `/partage/:token` ou
 * `/m/:worldSlug/apercu`, jamais la fiche d'edition — dans ce cas, jamais
 * de fenetre flottante non plus, une simple navigation.
 */
export function useOpenEntityLink(worldSlug: string, slug: string, hrefBase?: string) {
  const desktop = useDesktop();
  const href = hrefBase ? `${hrefBase}/${slug}` : `/m/${worldSlug}/f/${slug}`;

  return {
    href,
    onClick: (e: React.MouseEvent) => {
      if (hrefBase) return;
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      desktop.openRef({ kind: "entity", key: slug });
    },
  };
}
