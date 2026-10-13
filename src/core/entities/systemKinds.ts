import { SHARED_NOTE_KIND } from "../notebook/share";
import { WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";

/**
 * Les fiches système qui ne sont PAS des fiches du wiki (V3.1-96) : elles
 * n'apparaissent ni dans l'arborescence, ni dans la recherche, ni dans le
 * wiki public. Elles se lisent par leur propre écran (« Partagées à la
 * table », la Chronologie du monde). Le Livre de sessions (`session_journal`)
 * n'en fait pas partie : il a son groupe épinglé dans le sommaire.
 */
export const WIKI_HIDDEN_KINDS: readonly string[] = [SHARED_NOTE_KIND, WORLD_TIMELINE_KIND];

export function isWikiHiddenKind(kind: string): boolean {
  return WIKI_HIDDEN_KINDS.includes(kind);
}
