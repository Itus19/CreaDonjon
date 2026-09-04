import type { Rng } from "../dice/rng";
import type { RandomTableData, TableEntry } from "./types";
import { InvalidDieError, NoMatchingEntryError } from "./errors";

/**
 * Reconstruit une table a partir d'un SOUS-ENSEMBLE de ses entrees (ex.
 * filtre par palier, `entriesUpToTier`/`entriesAtExactTier` de
 * src/core/generators/variants.ts) — les plages d'origine ne couvrent plus
 * le de sans trou une fois des entrees retirees, `drawOnce`/`drawMultiple`
 * planteraient sur un jet tombant dans un trou. Replage les entrees
 * fournies de facon CONTIGUE (1..somme des poids), die redimensionne en
 * consequence, pour reutiliser `drawOnce`/`drawMultiple` tels quels plutot
 * que dupliquer leur logique de tirage/unicite dans un second mecanisme
 * pondere. `weight` reste le seul denominateur (le poids documentaire de
 * chaque entree devient ici sa vraie etendue de plage).
 */
export function buildFilteredTable<T extends RandomTableData>(source: T, entries: readonly TableEntry[]): T {
  let cursor = 1;
  const reflowed: TableEntry[] = entries.map((entry) => {
    const span = Math.max(1, Math.round(entry.weight));
    const range = { min: cursor, max: cursor + span - 1 };
    cursor += span;
    return { ...entry, range };
  });
  const totalSpan = Math.max(1, cursor - 1);
  return { ...source, die: `d${totalSpan}`, entries: reflowed };
}

/** "d20" -> 20, "d100" -> 100. Jamais un nombre de faces nu dans les donnees (specs/outils-mj.md §2.1). */
export function parseDie(die: string): number {
  const match = /^d(\d+)$/.exec(die.trim());
  const faces = match ? Number(match[1]) : NaN;
  if (!match || !Number.isInteger(faces) || faces <= 0) {
    throw new InvalidDieError(die);
  }
  return faces;
}

/** Lance le de du gabarit de table via le RNG fourni. Jamais Math.random() (CLAUDE.md regle 6). */
export function rollOnDie(die: string, rng: Rng): number {
  const faces = parseDie(die);
  return rng.nextInt(faces) + 1;
}

/** Entree dont la plage contient `roll`, ou `null` si aucune (table mal formee — jamais suppose, l'appelant decide). */
export function pickEntryForRoll(entries: readonly TableEntry[], roll: number): TableEntry | null {
  return entries.find((e) => roll >= e.range.min && roll <= e.range.max) ?? null;
}

const CASCADE_REF_RE = /\{table:([a-zA-Z0-9_-]+)\}/g;

/** Cles de table referencees par un texte de resultat, ex. "Une caravane de {table:marchands}..." -> ["marchands"]. Peut contenir des doublons — a l'appelant de deduplique s'il en a besoin. */
export function extractCascadeKeys(text: string): string[] {
  return [...text.matchAll(CASCADE_REF_RE)].map((m) => m[1]);
}

/** Remplace chaque `{table:cle}` par le resultat deja tire pour cette cle. Une cle absente de `resultsByKey` (echec de resolution en amont) reste telle quelle plutot que de faire echouer tout le tirage. */
export function interpolateCascadeResults(text: string, resultsByKey: ReadonlyMap<string, string>): string {
  return text.replace(CASCADE_REF_RE, (full, key: string) => resultsByKey.get(key) ?? full);
}

export interface TableDraw {
  entry: TableEntry;
  /** Cles de table a resoudre en cascade pour ce resultat (avant interpolation). */
  cascadeKeys: string[];
}

export interface SingleTableDraw extends TableDraw {
  roll: number;
}

/** Un tirage : lance le de, trouve l'entree, releve ses references de cascade. Ne resout PAS la cascade elle-meme (I/O — cote service, cf. src/server/services). */
export function drawOnce(table: RandomTableData, rng: Rng): SingleTableDraw {
  const roll = rollOnDie(table.die, rng);
  const entry = pickEntryForRoll(table.entries, roll);
  if (!entry) throw new NoMatchingEntryError(roll);
  return { entry, cascadeKeys: extractCascadeKeys(entry.text), roll };
}

/**
 * Plusieurs tirages sur la meme table. `unique_draws` (specs/outils-mj.md
 * §2.1) : jamais deux fois la meme entree tant qu'il en reste d'inutilisees
 * — retire par rejet (on relance jusqu'a tomber sur une entree neuve, borne
 * a un nombre d'essais raisonnable pour ne jamais boucler indefiniment sur
 * une table tres desequilibree), puis repli deterministe sur les entrees
 * encore inutilisees dans l'ordre si le rejet n'a pas suffi. Jamais plus de
 * resultats que d'entrees distinctes dans ce mode.
 */
export function drawMultiple(table: RandomTableData, count: number, rng: Rng): TableDraw[] {
  if (!table.unique_draws) {
    return Array.from({ length: count }, () => drawOnce(table, rng));
  }

  const targetCount = Math.min(count, table.entries.length);
  const usedIndexes = new Set<number>();
  const results: TableDraw[] = [];
  const maxAttempts = table.entries.length * 10 + 10;

  for (let attempt = 0; results.length < targetCount && attempt < maxAttempts; attempt++) {
    const roll = rollOnDie(table.die, rng);
    const index = table.entries.findIndex((e) => roll >= e.range.min && roll <= e.range.max);
    if (index === -1 || usedIndexes.has(index)) continue;
    usedIndexes.add(index);
    const entry = table.entries[index];
    results.push({ entry, cascadeKeys: extractCascadeKeys(entry.text) });
  }

  for (let index = 0; results.length < targetCount && index < table.entries.length; index++) {
    if (usedIndexes.has(index)) continue;
    usedIndexes.add(index);
    const entry = table.entries[index];
    results.push({ entry, cascadeKeys: extractCascadeKeys(entry.text) });
  }

  return results;
}
