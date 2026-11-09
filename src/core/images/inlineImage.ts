import type { AnchorableBlock } from "./blockAnchor";

/**
 * V3.1-189 (option B, ADR 0064) — une image posee DANS le texte d'un
 * paragraphe, a n'importe quel endroit d'une phrase.
 *
 * Le texte porte seulement la position : un noeud `{ t: "image", blockId }`
 * dans le contenu d'un segment (`zSegmentContentNode`). Tout le reste (adresse,
 * legende, habillage `anchorFlow`, `align`, `sizePct`) vit sur le bloc image,
 * qui garde sa propre visibilite. Aucun champ « je suis dans le texte » n'est
 * stocke : une image est dans le texte des qu'un paragraphe la cite (valeur
 * derivee, regle 16).
 *
 * Regle de visibilite (decision de l'auteur, 9 novembre 2026) : une image
 * cachee a un lecteur est cachee partout, y compris dans le texte, qui se
 * comporte alors comme si elle n'etait pas la. Et une image posee dans un
 * paragraphe que ce lecteur ne voit pas disparait avec lui : elle ne retombe
 * jamais a sa place d'origine dans le fil de la fiche.
 */

type SegmentLike = { blockType?: unknown; content?: unknown };

function segmentsOf(block: AnchorableBlock): SegmentLike[] | null {
  if (block.blockType !== "text") return null;
  const segments = (block.data as { segments?: unknown } | null)?.segments;
  return Array.isArray(segments) ? (segments as SegmentLike[]) : null;
}

function imageIdOf(node: unknown): string | null {
  if (typeof node !== "object" || node === null) return null;
  const { t, blockId } = node as { t?: unknown; blockId?: unknown };
  return t === "image" && typeof blockId === "string" ? blockId : null;
}

/** Identifiants des blocs image cites par au moins un paragraphe d'un bloc texte. */
export function inlineImageIdsIn(blocks: readonly AnchorableBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    for (const segment of segmentsOf(block) ?? []) {
      if (!Array.isArray(segment.content)) continue;
      for (const node of segment.content) {
        const id = imageIdOf(node);
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * A appliquer cote serveur, APRES le filtrage des blocs et des segments pour
 * ce lecteur, avant l'envoi (regle 5).
 *
 * `rawInlineIds` : `inlineImageIdsIn` des blocs BRUTS (avant tout filtrage),
 * pour savoir quelles images vivent dans le texte meme quand leur paragraphe
 * a ete retire.
 *
 * 1. Retire du texte toute image dont le bloc n'est pas parmi les visibles ;
 *    un paragraphe qui n'avait que cette image disparait (un trait de
 *    separation, vide par nature, reste).
 * 2. Retire de la liste tout bloc image qui vit dans le texte mais qu'aucun
 *    paragraphe visible ne cite plus : son paragraphe est cache. Exception :
 *    une image qui sert de fond de page reste un fond (« fond seul »).
 *
 * Ne modifie jamais les blocs recus.
 */
export function applyInlineImageVisibility<T extends AnchorableBlock>(rawInlineIds: ReadonlySet<string>, visibleBlocks: readonly T[]): T[] {
  const visibleImageIds = new Set(visibleBlocks.filter((b) => b.blockType === "image").map((b) => b.id));

  const stripped = visibleBlocks.map((block) => {
    const segments = segmentsOf(block);
    if (!segments) return block;
    let changed = false;
    const kept: SegmentLike[] = [];
    for (const segment of segments) {
      if (!Array.isArray(segment.content)) {
        kept.push(segment);
        continue;
      }
      const content = segment.content.filter((node) => {
        const id = imageIdOf(node);
        return id === null || visibleImageIds.has(id);
      });
      if (content.length === segment.content.length) {
        kept.push(segment);
        continue;
      }
      changed = true;
      if (content.length > 0 || segment.blockType === "divider") kept.push({ ...segment, content });
    }
    if (!changed) return block;
    return { ...block, data: { ...(block.data as object), segments: kept } };
  });

  const stillCited = inlineImageIdsIn(stripped);
  return stripped.flatMap((block) => {
    if (block.blockType !== "image" || !rawInlineIds.has(block.id) || stillCited.has(block.id)) return [block];
    // Son paragraphe est cache a ce lecteur. Une image qui sert aussi de fond
    // de page garde ce role (ce n'est pas l'image qui est cachee), mais ne se
    // montre plus dans la page : elle passe en « fond seul » pour ce rendu.
    const data = block.data as { useAsWikiBackground?: unknown } | null;
    if (data?.useAsWikiBackground === true) return [{ ...block, data: { ...data, alsoShowInFlow: false } }];
    return [];
  });
}
