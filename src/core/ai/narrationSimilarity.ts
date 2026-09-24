/**
 * V3-B4 — Détection de similarité, « mesure simple, pas d'embedding ».
 *
 * Jaccard sur des ensembles de mots (accents et casse ignorés) : deux
 * narrations qui partagent le plus gros de leur vocabulaire sont jugées
 * proches, sans jamais lancer d'appel réseau ni charger de modèle
 * d'embedding pour ça — exactement ce que « mesure simple » demande.
 *
 * Volontairement grossier : ça n'a pas besoin de comprendre le sens, juste
 * de repérer la réplique quasi identique qui revient trois tours de suite
 * (le défaut constaté dans le spike, ADR 0009).
 */

const WORD_PATTERN = /[a-z0-9]+/g;

function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return new Set(normalized.match(WORD_PATTERN) ?? []);
}

/** 0 (aucun mot commun) à 1 (meme ensemble de mots exactement) — deux textes vides sont juges identiques (1), jamais une division par zero. */
export function narrationSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection += 1;
  const union = setA.size + setB.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

/** La plus forte similarité de `candidate` contre chacune des narrations récentes — 0 si la liste est vide, rien à comparer. */
export function maxSimilarityToRecent(candidate: string, recent: string[]): number {
  if (recent.length === 0) return 0;
  return Math.max(...recent.map((text) => narrationSimilarity(candidate, text)));
}
