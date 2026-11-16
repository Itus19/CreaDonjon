import type { Segment } from "../schemas/entities/segments";
import type { TextBlockData } from "../schemas/blocks/text";

/**
 * V3.1-189 — choisir, depuis le bloc image, le bloc texte ou l'image
 * apparait. Le texte est la seule source de la position (`inlineImage.ts`) :
 * choisir un bloc, c'est ecrire le noeud dans ses segments et le retirer de
 * partout ailleurs. Le placement fin se fait ensuite a la souris, dans le
 * texte.
 */

export interface TextBlockLike {
  id: string;
  data: TextBlockData;
}

function cites(segments: readonly Segment[], imageId: string): boolean {
  return segments.some((s) => s.content.some((n) => n.t === "image" && n.blockId === imageId));
}

/** Le bloc texte qui porte l'image, ou `null` si elle n'est dans aucun texte. */
export function textHostOf(blocks: readonly TextBlockLike[], imageId: string): string | null {
  return blocks.find((b) => cites(b.data.segments, imageId))?.id ?? null;
}

/** Retire l'image des segments ; un paragraphe qui n'avait qu'elle disparait (un trait, vide par nature, reste). */
function withoutImage(segments: readonly Segment[], imageId: string): Segment[] {
  return segments.flatMap((segment) => {
    const content = segment.content.filter((n) => !(n.t === "image" && n.blockId === imageId));
    if (content.length === segment.content.length) return [segment];
    return content.length > 0 || segment.blockType === "divider" ? [{ ...segment, content }] : [];
  });
}

/** Ou poser l'image dans le bloc vise : l'ancien ancrage par paragraphe (V2.1-11), pour la garder a sa place en passant au nouveau format. */
export interface LegacyAnchorTarget {
  segmentId: string | null;
  position: "before" | "after";
}

/**
 * Pose l'image en tete du premier paragraphe ou titre ; sans aucun, un
 * paragraphe neuf la porte. Avec un ancien ancrage : en tete du paragraphe
 * vise (« avant »), ou a sa fin (« apres », le dernier cran) ; un paragraphe
 * disparu, ou un trait, retombe en tete du bloc.
 */
function withImageAtStart(segments: readonly Segment[], imageId: string, newSegmentId: string, at?: LegacyAnchorTarget): Segment[] {
  const node = { t: "image" as const, blockId: imageId };
  const vise = at?.segmentId ? segments.findIndex((s) => s.id === at.segmentId && s.blockType !== "divider") : -1;
  if (vise !== -1) {
    return segments.map((s, k) => (k === vise ? { ...s, content: at?.position === "after" ? [...s.content, node] : [node, ...s.content] } : s));
  }
  const index = segments.findIndex((s) => s.blockType !== "divider");
  if (index === -1) {
    return [...segments, { id: newSegmentId, blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [node], align: "left" }];
  }
  return segments.map((s, k) => (k === index ? { ...s, content: [node, ...s.content] } : s));
}

/**
 * Les blocs texte a reecrire pour que l'image soit dans `targetId` (en tete),
 * ou dans aucun texte si `targetId` vaut `null`. Ne rend que les blocs qui
 * changent ; rien si l'image est deja dans le bloc vise (sa place fine,
 * choisie a la souris, est gardee).
 */
export function placeImageInText(
  blocks: readonly TextBlockLike[],
  imageId: string,
  targetId: string | null,
  newSegmentId: string,
  at?: LegacyAnchorTarget
): TextBlockLike[] {
  if (targetId !== null && textHostOf(blocks, imageId) === targetId) return [];
  const changes: TextBlockLike[] = [];
  for (const block of blocks) {
    let segments = block.data.segments;
    if (cites(segments, imageId)) segments = withoutImage(segments, imageId);
    if (block.id === targetId) segments = withImageAtStart(segments, imageId, newSegmentId, at);
    if (segments !== block.data.segments) changes.push({ id: block.id, data: { ...block.data, segments } });
  }
  return changes;
}
