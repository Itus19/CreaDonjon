import type { ImageBlockData } from "@/src/core/schemas/blocks/image";

/**
 * V2.1-10 — un bloc `image` ancre sort du fil des blocs et va s'inserer DANS
 * un autre bloc, avant l'un de ses segments.
 *
 * Meme motif que `planMusicAttachments` (src/core/music/blockAttachment.ts) :
 * ce fichier ne calcule que le PLAN — quelle image, quel bloc hote, avant
 * quel segment, et comment le texte reagit. Le rendu appartient a
 * `PublicEntityBody`.
 *
 * Ce qui merite d'etre ici plutot que dans un composant serveur, c'est
 * l'arbitrage : la traduction des anciens blocs `wrapMode` et les quatre
 * replis de cible perdue. Ils s'eprouvent en millisecondes, alors qu'ils
 * demanderaient un wiki publie et un navigateur s'ils vivaient dans le rendu.
 *
 * Pourquoi l'ancrage vise un SEGMENT et non un pourcentage de hauteur : un
 * flottement CSS s'accroche au point du flux ou il est insere. « Place cette
 * image a 40 % de la hauteur du bloc » n'existe pas — il faut l'inserer avant
 * le Ne paragraphe. L'unite honnete est donc le segment, qui porte deja un
 * `id` stable.
 */

/** Forme minimale d'un bloc pour ce calcul — `PublicBlock` (serveur) la satisfait, sans que le noyau ait a en dependre. */
export interface AnchorableBlock {
  id: string;
  blockType: string;
  data: unknown;
}

/** « Le texte contourne » (flottement) ou « l'image coupe le texte » (pleine largeur, entre deux segments). */
export type AnchorFlow = "contourne" | "coupe";

export interface AnchoredImage<T extends AnchorableBlock> {
  block: T;
  /** Segment du bloc hote contre lequel l'image se pose ; `null` = en tete du bloc. */
  segmentId: string | null;
  /** De quel cote de ce segment. `"after"` ne sert qu'au dernier cran, « a la fin du bloc ». */
  position: "before" | "after";
  flow: AnchorFlow;
}

export interface ImageAnchorPlan<T extends AnchorableBlock> {
  /** Le fil de la fiche, images ancrees retirees — tout le reste dans son ordre d'origine. */
  contentBlocks: T[];
  /** Indexe par identifiant de bloc HOTE, chaque liste dans l'ordre de la fiche. */
  anchors: Record<string, AnchoredImage<T>[]>;
}

/**
 * Identifiants des segments d'un bloc, ou `null` s'il ne peut pas heberger
 * d'image. Seul un bloc `text` le peut : l'ancrage vise un segment, et c'est
 * le seul type qui en porte. Un bloc texte VIDE reste un hote valide (`[]`)
 * — on peut y ancrer en tete.
 */
function segmentIdsOf(block: AnchorableBlock): string[] | null {
  if (block.blockType !== "text") return null;
  const segments = (block.data as { segments?: unknown } | null)?.segments;
  if (!Array.isArray(segments)) return null;
  return segments
    .map((segment) => (typeof segment === "object" && segment !== null ? (segment as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string");
}

/**
 * Cible retenue pour une image, ou `null` pour « reste dans le fil ».
 *
 * L'ancrage explicite prime toujours sur l'ancien `wrapMode` : un bloc
 * modifie depuis V2.1-10 ne doit jamais retomber sur la cible implicite.
 */
function resolveAnchor<T extends AnchorableBlock>(
  block: T,
  index: number,
  blocks: T[],
  hostSegments: Map<string, string[]>
): { hostId: string; segmentId: string | null; position: "before" | "after"; flow: AnchorFlow } | null {
  const data = block.data as Partial<ImageBlockData> | null;

  if (data?.placement === "ancree" && data.anchor) {
    const hostId = data.anchor.blockId;
    // Une image ancree a elle-meme se rendrait a l'interieur d'elle-meme.
    if (hostId === block.id) return null;
    const segments = hostSegments.get(hostId);
    // Bloc cible supprime, ou incapable d'heberger : l'image reprend sa place
    // dans le fil plutot que de disparaitre.
    if (!segments) return null;
    const wanted = data.anchor.segmentId;
    // Segment supprime depuis l'ancrage : on remonte en tete du bloc, jamais
    // a une position devinee. Le cote perd alors son sens avec lui.
    const segmentId = wanted && segments.includes(wanted) ? wanted : null;
    return {
      hostId,
      segmentId,
      position: segmentId !== null && data.anchor.position === "after" ? "after" : "before",
      flow: data.anchorFlow === "coupe" ? "coupe" : "contourne",
    };
  }

  // Blocs anterieurs a V2.1-10 : `wrapMode: "wrap"` faisait flotter l'image et
  // laissait le bloc SUIVANT s'ecouler autour. Meme resultat visible, mais
  // l'image entre desormais dans le bloc — ce qui supprime la bordure
  // orpheline et le decalage au-dessus du titre. Aucune ecriture en base : la
  // traduction se refait a chaque rendu, jusqu'a ce que l'auteur reregle le
  // bloc lui-meme.
  if (data?.wrapMode === "wrap") {
    const next = blocks[index + 1];
    // Sans bloc suivant, ou suivi d'un bloc sans segments (une quete, une
    // carte), il n'y a rien dans quoi inserer : le repli est le flux.
    if (!next || !hostSegments.has(next.id)) return null;
    return { hostId: next.id, segmentId: null, position: "before", flow: "contourne" };
  }

  return null;
}

export function planImageAnchors<T extends AnchorableBlock>(blocks: T[]): ImageAnchorPlan<T> {
  const hostSegments = new Map<string, string[]>();
  for (const block of blocks) {
    const segments = segmentIdsOf(block);
    if (segments) hostSegments.set(block.id, segments);
  }

  const contentBlocks: T[] = [];
  const anchors: Record<string, AnchoredImage<T>[]> = {};

  blocks.forEach((block, index) => {
    if (block.blockType !== "image") {
      contentBlocks.push(block);
      return;
    }
    const resolved = resolveAnchor(block, index, blocks, hostSegments);
    if (!resolved) {
      contentBlocks.push(block);
      return;
    }
    const list = anchors[resolved.hostId] ?? (anchors[resolved.hostId] = []);
    list.push({ block, segmentId: resolved.segmentId, position: resolved.position, flow: resolved.flow });
  });

  return { contentBlocks, anchors };
}
