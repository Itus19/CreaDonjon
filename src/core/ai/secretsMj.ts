import { nodeText } from "@/src/core/richtext/nodeText";
import type { SegmentLu } from "@/src/core/entities/premierePhrase";

/**
 * ADR 0116 — En solo, le moteur et l'IA forment à eux deux le MJ : l'IA reçoit
 * aussi ce que seul le MJ sait, À PART de ce que le personnage sait. Ces
 * fonctions pures font la différence entre les deux lectures d'une même page
 * (filtrées par l'appelant, règle 5) : ce qui est lisible par le MJ et pas
 * par la personne qui joue.
 */

/** Les paragraphes d'une page, en texte brut, dans l'ordre. */
export function paragraphesDe(segments: readonly SegmentLu[]): string[] {
  return segments
    .filter((s) => s.blockType === "paragraph")
    .map((s) => s.content.map(nodeText).join("").replace(/\s+/g, " ").trim())
    .filter((t) => t !== "");
}

/**
 * Ce que le MJ lit et que le personnage ne lit pas, borné à `max` caractères
 * (phrases entières tant qu'elles tiennent, puis coupure au mot). `null` :
 * aucun secret.
 */
export function secretsEntre(lusParLeMj: readonly string[], lusParLeJoueur: readonly string[], max = 500): string | null {
  const connus = new Set(lusParLeJoueur);
  const texte = lusParLeMj.filter((p) => !connus.has(p)).join(" ");
  if (texte === "") return null;
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${(dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
}
