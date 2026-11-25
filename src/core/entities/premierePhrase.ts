import type { SegmentContentNode, SegmentBlockType } from "@/src/core/schemas/entities/segments";
import { nodeText } from "@/src/core/richtext/nodeText";

/**
 * La phrase d'une carte de PJ (V3.1-82, choix du personnage) : la première
 * phrase du premier paragraphe d'un bloc de texte. L'appelant ne passe QUE des
 * segments déjà filtrés pour la joueuse (règle 5) ; cette fonction ne voit
 * jamais la visibilité.
 *
 * Un passage marqué `spoiler` n'est jamais repris : la marque masque un texte
 * à l'écran (règle 6 : de la mise en forme, pas de la sécurité), et le
 * recopier en clair dans une carte trahirait l'intention de l'auteur.
 */
export interface SegmentLu {
  blockType: SegmentBlockType;
  content: SegmentContentNode[];
}

const FIN_DE_PHRASE = /[.!?…](?=\s|$)/;

function texteDuParagraphe(content: SegmentContentNode[]): string {
  return content
    .map((node) => (node.t === "text" && node.marks?.includes("spoiler") ? "" : nodeText(node)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function premierePhrase(segments: readonly SegmentLu[], max = 160): string | null {
  for (const segment of segments) {
    if (segment.blockType !== "paragraph") continue;
    const texte = texteDuParagraphe(segment.content);
    if (texte === "") continue;
    const fin = FIN_DE_PHRASE.exec(texte);
    const phrase = fin ? texte.slice(0, fin.index + 1) : texte;
    if (phrase.length <= max) return phrase;
    const coupe = phrase.slice(0, max);
    const dernierEspace = coupe.lastIndexOf(" ");
    return `${(dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
  }
  return null;
}

const PHRASES = /[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/g;

/**
 * Le premier paragraphe d'un bloc de texte, borné à `max` caractères : la
 * description d'un lieu que la narration solo reçoit pour pouvoir décrire
 * quelque chose de vrai. Même contrat que `premierePhrase` : segments déjà
 * filtrés par l'appelant (règle 5), passages `spoiler` jamais repris.
 * Trop long, il garde les phrases entières qui tiennent ; une seule phrase
 * trop longue est coupée à un mot.
 */
export function premierParagraphe(segments: readonly SegmentLu[], max = 600): string | null {
  for (const segment of segments) {
    if (segment.blockType !== "paragraph") continue;
    const texte = texteDuParagraphe(segment.content);
    if (texte === "") continue;
    if (texte.length <= max) return texte;
    let garde = "";
    for (const phrase of texte.match(PHRASES) ?? []) {
      const suivant = `${garde}${phrase}`;
      if (suivant.trim().length > max) break;
      garde = suivant;
    }
    if (garde.trim() !== "") return garde.trim();
    const coupe = texte.slice(0, max);
    const dernierEspace = coupe.lastIndexOf(" ");
    return `${(dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
  }
  return null;
}

