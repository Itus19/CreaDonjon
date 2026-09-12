"use client";

import { useDesktop } from "./DesktopContext";
import { windowHref, type RuleToolKey } from "./windowRefs";

/**
 * Miroir de `useOpenRuleLink`/`useOpenMjToolLink` (ADR-0011) pour un
 * formulaire de creation de regle maison (retour utilisateur : ces
 * formulaires doivent s'ouvrir "comme les autres fiches") : un clic normal
 * ouvre/focus sa fenetre plutot que de naviguer en plein cadre, jamais de
 * fermeture des autres fenetres deja ouvertes — c'est ce qui permet
 * d'ouvrir "creer un don" par-dessus "creer un historique" sans perdre son
 * brouillon. ctrl/cmd/molette laissent le navigateur ouvrir un nouvel
 * onglet normalement.
 */
export function useOpenRuleToolLink(worldSlug: string, key: RuleToolKey) {
  const desktop = useDesktop();

  return {
    href: windowHref(worldSlug, { kind: "rule-tool", key }),
    onClick: (e: React.MouseEvent) => {
      if (!desktop) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      desktop.openRef({ kind: "rule-tool", key });
    },
  };
}
