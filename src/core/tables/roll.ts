import type { Rng } from "../dice/rng";
import type { RandomTableData, TableEntry, TableEntryRange } from "./types";
import { InvalidDieError, NoMatchingEntryError, TableExhaustedError } from "./errors";

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

/**
 * Plage de la prochaine entree ajoutee a une table : tout ce qui RESTE du de
 * apres la derniere entree.
 *
 * Le defaut corrige (signale en saisissant la Taverne, V2-J1) : l'entree
 * ajoutee naissait de largeur nulle (`min = max = dernier_max + 1`), ce qui
 * laissait un trou entre elle et la fin du de — et `drawOnce` jette
 * `NoMatchingEntryError` des qu'un jet tombe dans ce trou. Une table
 * fraichement enrichie devenait donc intirable jusqu'a ce que l'auteur
 * reparre les plages a la main.
 *
 * Un `die` incomplet n'est pas une erreur ici : l'editeur laisse taper "d"
 * avant "d20", et la frappe suivante recalculera la plage. On retombe alors
 * sur une largeur 1, exactement l'ancien comportement.
 *
 * Quand la derniere entree couvre deja tout le de (l'etat de depart d'un
 * bloc `random_table` neuf, cf. `registry.ts`), il ne reste rien a couvrir :
 * la plage renvoyee sort du de. L'entree est inatteignable au tirage, mais
 * elle ne cree JAMAIS de trou — c'est a l'auteur de repartir ses plages.
 */
export function nextEntryRange(entries: readonly TableEntry[], die: string): TableEntryRange {
  const lastMax = entries.at(-1)?.range.max ?? 0;
  let faces: number;
  try {
    faces = parseDie(die);
  } catch {
    // catch-attendu : notation de de incomplete pendant la frappe — un etat attendu, pas une
    // panne : `Math.max` ci-dessous retombe seul sur une plage de largeur 1.
    faces = 0;
  }
  return { min: lastMax + 1, max: Math.max(lastMax + 1, faces) };
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
  /** V3.1-75 : l'indice de l'entree sortie dans `table.entries` (la ligne qui s'allume, et ce que « sans repetition » retient). */
  index: number;
}

/** Un tirage : lance le de, trouve l'entree, releve ses references de cascade. Ne resout PAS la cascade elle-meme (I/O — cote service, cf. src/server/services). */
export function drawOnce(table: RandomTableData, rng: Rng): SingleTableDraw {
  const roll = rollOnDie(table.die, rng);
  const index = table.entries.findIndex((e) => roll >= e.range.min && roll <= e.range.max);
  if (index === -1) throw new NoMatchingEntryError(roll);
  const entry = table.entries[index];
  return { entry, cascadeKeys: extractCascadeKeys(entry.text), roll, index };
}

/**
 * V3.1-75 — un tirage qui evite les entrees deja sorties (`exclude`, indices),
 * pour « Sans repetition » d'un appel a l'autre. Rejet d'abord (on relance le
 * de, borne), puis repli sur une entree restante choisie par le RNG, avec un
 * chiffre tire dans SA plage : le chiffre montre correspond toujours a la
 * ligne sortie. Toutes sorties : `TableExhaustedError`.
 */
export function drawExcluding(table: RandomTableData, exclude: ReadonlySet<number>, rng: Rng): SingleTableDraw {
  const remaining = table.entries.map((_, i) => i).filter((i) => !exclude.has(i));
  if (remaining.length === 0) throw new TableExhaustedError();
  const maxAttempts = table.entries.length * 10 + 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const roll = rollOnDie(table.die, rng);
    const index = table.entries.findIndex((e) => roll >= e.range.min && roll <= e.range.max);
    if (index === -1 || exclude.has(index)) continue;
    const entry = table.entries[index];
    return { entry, cascadeKeys: extractCascadeKeys(entry.text), roll, index };
  }
  const index = remaining[rng.nextInt(remaining.length)];
  const entry = table.entries[index];
  const span = Math.max(1, entry.range.max - entry.range.min + 1);
  const roll = entry.range.min + rng.nextInt(span);
  return { entry, cascadeKeys: extractCascadeKeys(entry.text), roll, index };
}

/**
 * Plusieurs tirages sur la meme table. `unique_draws` (specs/outils-mj.md
 * §2.1) : jamais deux fois la meme entree tant qu'il en reste d'inutilisees
 * — chaque tirage passe par `drawExcluding` (rejet borne, puis repli sur une
 * entree restante choisie par le RNG). Jamais plus de resultats que
 * d'entrees distinctes restantes dans ce mode.
 */
export function drawMultiple(
  table: RandomTableData,
  count: number,
  rng: Rng,
  /** V3.1-75 : entrees deja sorties lors d'appels precedents (seulement avec `unique_draws`). */
  alreadyDrawn: ReadonlySet<number> = new Set()
): SingleTableDraw[] {
  if (!table.unique_draws) {
    return Array.from({ length: count }, () => drawOnce(table, rng));
  }

  const used = new Set(alreadyDrawn);
  const remaining = table.entries.filter((_, i) => !used.has(i)).length;
  // Epuisee PAR les tirages precedents seulement : une table vide (palier filtre, generateurs) rend toujours une liste vide.
  if (count > 0 && remaining === 0 && used.size > 0) throw new TableExhaustedError();
  const targetCount = Math.min(count, remaining);
  const results: SingleTableDraw[] = [];
  while (results.length < targetCount) {
    const draw = drawExcluding(table, used, rng);
    used.add(draw.index);
    results.push(draw);
  }
  return results;
}
