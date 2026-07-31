import { normalizeForMatching } from "./normalize";

/**
 * Entite candidate a la detection (docs/BACKLOG.md V0-05,
 * specs/wiki-liens-et-personnages.md §A1-A2). Le nom ET les alias sont des
 * termes recherchables — un texte peut mentionner l'entite par l'un ou
 * l'autre.
 */
export interface LinkableEntity {
  id: string;
  name: string;
  aliases: string[];
}

export interface DetectedCandidate {
  entityId: string;
  term: string;
}

export interface DetectedReference {
  start: number;
  end: number;
  matchedText: string;
  /** Plus d'un candidat = alias partage par plusieurs entites, jamais resolu au hasard. */
  candidates: DetectedCandidate[];
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

interface RawMatch {
  start: number;
  end: number;
  normalizedTerm: string;
}

/** Toutes les occurrences d'un terme normalise dans le texte normalise, frontieres de mots respectees. */
function findOccurrences(normalizedText: string, normalizedTerm: string, originalText: string): RawMatch[] {
  if (normalizedTerm.length === 0) return [];

  const matches: RawMatch[] = [];
  let fromIndex = 0;
  for (;;) {
    const index = normalizedText.indexOf(normalizedTerm, fromIndex);
    if (index === -1) break;
    const end = index + normalizedTerm.length;

    const boundaryBefore = !isWordChar(originalText[index - 1]);
    const boundaryAfter = !isWordChar(originalText[end]);
    if (boundaryBefore && boundaryAfter) {
      matches.push({ start: index, end, normalizedTerm });
    }
    fromIndex = index + 1;
  }
  return matches;
}

/**
 * Detecte les mentions d'entites connues dans un texte (fonction pure,
 * testee sans base — docs/BACKLOG.md V0-05). Commence strict : correspondance
 * exacte de nom ou d'alias complet, jamais de correspondance partielle ou
 * approximative — assouplir uniquement si un besoin concret le reclame et
 * en mesurant les faux positifs (PDD §6).
 */
export function detectEntityReferences(
  text: string,
  entities: readonly LinkableEntity[]
): DetectedReference[] {
  const normalizedText = normalizeForMatching(text);

  // normalizedTerm -> candidats partageant ce terme exact (alias homonymes).
  const candidatesByTerm = new Map<string, DetectedCandidate[]>();
  for (const entity of entities) {
    const terms = [entity.name, ...entity.aliases];
    for (const term of terms) {
      if (term.length === 0) continue;
      const normalizedTerm = normalizeForMatching(term);
      const existing = candidatesByTerm.get(normalizedTerm) ?? [];
      existing.push({ entityId: entity.id, term });
      candidatesByTerm.set(normalizedTerm, existing);
    }
  }

  const rawMatches: RawMatch[] = [];
  for (const normalizedTerm of candidatesByTerm.keys()) {
    rawMatches.push(...findOccurrences(normalizedText, normalizedTerm, text));
  }

  // Priorite a la correspondance la plus longue (docs/BACKLOG.md V0-05) :
  // trie par position de depart, la plus longue d'abord a position egale,
  // puis balayage glouton qui supprime tout ce qui chevauche une
  // correspondance deja retenue.
  rawMatches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const accepted: DetectedReference[] = [];
  let lastAcceptedEnd = -1;
  for (const match of rawMatches) {
    if (match.start < lastAcceptedEnd) continue;
    accepted.push({
      start: match.start,
      end: match.end,
      matchedText: text.slice(match.start, match.end),
      // Copie defensive : deux detections distinctes ne doivent jamais partager le meme tableau.
      candidates: [...(candidatesByTerm.get(match.normalizedTerm) ?? [])],
    });
    lastAcceptedEnd = match.end;
  }

  return accepted;
}
