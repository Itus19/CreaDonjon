import { canSee } from "./canSee";
import type { VisibilityAware, VisibilityContext, Viewer } from "./types";

/**
 * Retire les segments narratifs interdits. Ils sont absents du tableau
 * retourne, jamais seulement marques : un objet marque "cache" mais
 * present dans la reponse est deja une fuite (SCHEMA.md §4.2, §6).
 */
export function filterSegments<T extends VisibilityAware>(
  segments: readonly T[],
  viewer: Viewer,
  ctx: VisibilityContext = {},
): T[] {
  return segments.filter((segment) => canSee(segment.visibility, viewer, ctx));
}

/** Meme principe que `filterSegments`, applique aux blocs d'une entite. */
export function filterBlocks<T extends VisibilityAware>(
  blocks: readonly T[],
  viewer: Viewer,
  ctx: VisibilityContext = {},
): T[] {
  return blocks.filter((block) => canSee(block.visibility, viewer, ctx));
}
