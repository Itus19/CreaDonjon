import { SHARED_NOTE_KIND } from "../notebook/share";
import { WORLD_TIMELINE_KIND } from "../timeline/worldTimeline";

/**
 * Une entrée du Livre de sessions (V2.1-3). Défini ici, dans le noyau, pour
 * que la règle des types système ci-dessous la connaisse ;
 * `sessionJournalTree.ts` le réexporte côté serveur.
 */
export const SESSION_JOURNAL_KIND = "session_journal";

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

/**
 * Les types qu'une fiche ne reçoit QUE par son propre parcours : un devoir
 * (Livre de sessions), un partage du cahier, la Chronologie. Ni le sélecteur
 * de type ni la création libre ne les proposent.
 */
export const SYSTEM_KINDS: readonly string[] = [SESSION_JOURNAL_KIND, SHARED_NOTE_KIND, WORLD_TIMELINE_KIND];

export function isSystemKind(kind: string): boolean {
  return SYSTEM_KINDS.includes(kind);
}

/**
 * Changer le type d'une fiche (sélecteur de l'en-tête). Bug réel du
 * 1ᵉʳ novembre : une page partagée du cahier passée à la main en
 * `session_journal` n'était plus nulle part — le sommaire écarte ce type,
 * et le Livre ne liste que les fiches rattachées à un devoir rédigé. Même
 * piège en sens inverse : une entrée du Livre ou une page partagée qui
 * change de type laisse son devoir ou son cahier pointer sur une fiche
 * étrangère. On n'entre donc dans un type système, et on n'en sort, que par
 * son parcours ; garder le même type reste toujours permis.
 */
export function canChangeEntityKind(from: string, to: string): boolean {
  if (from === to) return true;
  return !isSystemKind(from) && !isSystemKind(to);
}
