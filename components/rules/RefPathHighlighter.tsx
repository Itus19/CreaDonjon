"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const HIGHLIGHT_DURATION_MS = 2500;

/**
 * Suivre un renvoi entrant (RuleRefsPanel) mene sur la fiche source avec
 * `?path=...` : cet element cherche le noeud portant `data-ref-path` egal a
 * cette valeur (pose par ClassProgression dans RuleBlockRenderer), le fait
 * defiler en vue et le surligne brievement — "surligne le chemin exact dans
 * la structure quand on le suit" (V1-A3). Comparaison directe des attributs
 * plutot qu'un selecteur CSS construit depuis `path` : aucune valeur venant
 * de la donnee n'est jamais interpolee dans une chaine de selecteur.
 */
export default function RefPathHighlighter() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path");

  useEffect(() => {
    if (!path) return;

    let target: Element | null = null;
    for (const el of document.querySelectorAll("[data-ref-path]")) {
      if (el.getAttribute("data-ref-path") === path) {
        target = el;
        break;
      }
    }
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("ref-highlight");
    const timeout = setTimeout(() => target.classList.remove("ref-highlight"), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [path]);

  return null;
}
