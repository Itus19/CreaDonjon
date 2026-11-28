import { normalizeForMatching } from "../linker/normalize";

/**
 * V3.2-81 (ADR 0122, amendement du 28 novembre) — Les signes distinctifs
 * dissimulés : un paragraphe de description marqué `concealed` (un tatouage
 * sous un bandage), avec une difficulté pour le trouver.
 *
 * Deux sortes de « caché » ne se confondent pas : la visibilité d'un
 * paragraphe dit QUI LE LIT (MJ, joueurs) ; la marque dit QUI LE VOIT dans
 * l'histoire. Un paragraphe dissimulé se lit donc selon ce qu'on a découvert
 * (facette `mark:<id du paragraphe>`), pas selon sa visibilité : celui d'un
 * PNJ s'écrit d'ordinaire pour le MJ, et apparaît quand on le découvre. La
 * personne qui joue lit toujours ceux de son propre personnage.
 */

export const markFacet = (segmentId: string): string => `mark:${segmentId}`;

type Concealable = { id: string; concealed?: { dc: number }; content: readonly ({ t: string; v?: string; label?: string })[] };

export interface MarkReader {
  /** La personne qui joue ce personnage : elle lit ses signes, difficulté comprise. */
  owner: boolean;
  /** Les facettes découvertes de cette entité. */
  known: ReadonlySet<string>;
}

/**
 * Les paragraphes que ce lecteur lit : un paragraphe ordinaire selon
 * `canRead` (sa visibilité) ; un paragraphe dissimulé selon la marque. `null` :
 * un lecteur sans indices (partage public, aperçu) ne lit aucun signe dissimulé.
 * La difficulté ne part jamais vers qui n'est pas le propriétaire (règle 5).
 */
export function readSegmentsWithMarks<T extends Concealable>(segments: readonly T[], canRead: (segment: T) => boolean, reader: MarkReader | null): T[] {
  return segments.flatMap((segment): T[] => {
    if (!segment.concealed) return canRead(segment) ? [segment] : [];
    if (reader?.owner) return [segment];
    if (!reader?.known.has(markFacet(segment.id))) return [];
    const copie = { ...segment };
    delete copie.concealed;
    return [copie];
  });
}

export function segmentPlainText(segment: Pick<Concealable, "content">): string {
  return segment.content
    .map((n) => (n.t === "text" ? (n.v ?? "") : n.t === "ref" ? (n.label ?? "") : ""))
    .join("")
    .trim();
}

/** Les signes dissimulés d'une page, avec leur difficulté et leur texte. */
export function concealedMarks(segments: readonly Concealable[]): { id: string; dc: number; text: string }[] {
  return segments.flatMap((s) => (s.concealed ? [{ id: s.id, dc: s.concealed.dc, text: segmentPlainText(s) }] : []));
}

const VIDES = new Set(["avec", "dans", "sous", "pour", "mais", "votre", "notre", "leurs", "cette", "celui", "celle", "entre", "contre", "comme", "porte", "gauche", "droite"]);
const motsForts = (s: string) => new Set(normalizeForMatching(s).split(/[^a-z0-9]+/).filter((m) => m.length >= 5 && !VIDES.has(m)));
/** Assez proches pour dire la même chose : « tatoue » et « tatouage » partagent leur début. */
const proches = (a: string, b: string) => a.slice(0, 5) === b.slice(0, 5);

/** Le signe dont parle la phrase (« mon tatouage de serpent ») : celui qui partage le plus de mots forts avec elle, s'il est seul en tête. */
export function paragrapheNomme(text: string, signes: readonly { id: string; text: string }[]): string | null {
  const phrase = [...motsForts(text)];
  const scores = signes.map((s) => ({ id: s.id, score: [...motsForts(s.text)].filter((m) => phrase.some((p) => proches(p, m))).length }));
  const meilleur = Math.max(0, ...scores.map((s) => s.score));
  const tete = scores.filter((s) => s.score === meilleur);
  return meilleur > 0 && tete.length === 1 ? tete[0]!.id : null;
}
