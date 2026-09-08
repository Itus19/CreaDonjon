import { nextSlugCandidate, slugify } from "../slug/slug";

/**
 * Decoupage d'une section de regle du SRD en un chapitre et ses regles
 * filles (V3-N7, `docs/BACKLOG_V3.md`).
 *
 * Pourquoi une fonction pure et pas un script d'import : le decoupage est
 * la partie qui decide (ou couper, quelle cle), et c'est la seule qui se
 * verifie exhaustivement contre les 33 sections reelles sans base ni
 * reseau. Le branchement en base est un autre ticket.
 *
 * **La profondeur de coupe n'est jamais devinee.** Le releve des 33
 * sections l'interdit : neuf n'ont aucun titre de niveau 3 et ne doivent
 * pas etre touchees, `actions-in-combat` se coupe proprement au niveau 3,
 * `traps` et `poisons` ont un niveau 3 qui n'est qu'un conteneur (« Sample
 * Traps ») dont les vraies fiches sont au niveau 4. Une heuristique se
 * tromperait sur un tiers des cas ; la profondeur est donc une donnee que
 * l'appelant fournit, chapitre par chapitre.
 */

/** Niveaux de titre markdown reconnus : `##` a `######`. `#` est le titre du document, jamais une regle. */
const MIN_DEPTH = 2;
const MAX_DEPTH = 6;

const HEADING = /^(#{2,6}) (.+)$/gm;

export interface RuleHeading {
  level: number;
  title: string;
}

export interface SplitChild {
  /** Titre lu dans le markdown, sans les diese ni espaces de bordure. */
  title: string;
  /** Cle derivee, prefixee par celle du chapitre — l'unicite est garantie a l'interieur d'un chapitre, et le prefixe l'etend a tout le ruleset. */
  key: string;
  /** Titre et contenu, verbatim : la tranche exacte du markdown d'origine. */
  prose: string;
}

export interface RuleSectionSplit {
  /** Tout ce qui precede la premiere coupe, verbatim — titre du chapitre et introduction compris. */
  chapterProse: string;
  children: SplitChild[];
}

/**
 * Sommaire des titres d'une section, dans l'ordre du document. C'est ce
 * qu'un humain regarde pour choisir la profondeur de coupe d'un chapitre —
 * la decision que `splitRuleSection` applique sans jamais la prendre.
 */
export function outlineRuleSection(markdown: string): RuleHeading[] {
  const out: RuleHeading[] = [];
  for (const match of markdown.matchAll(HEADING)) {
    out.push({ level: match[1].length, title: match[2].trim() });
  }
  return out;
}

/**
 * Coupe `markdown` a la profondeur demandee.
 *
 * Le decoupage se fait par tranches contiguës de la chaine d'origine,
 * jamais en recomposant des lignes : la propriete « ni perte ni doublon »
 * est donc vraie par construction, et le test dore la verifie sur les 33
 * sections a toutes les profondeurs.
 */
export function splitRuleSection(
  markdown: string,
  options: { parentKey: string; depth: number }
): RuleSectionSplit {
  const { parentKey, depth } = options;
  if (!Number.isInteger(depth) || depth < MIN_DEPTH || depth > MAX_DEPTH) {
    throw new RangeError(
      `Profondeur de coupe invalide : ${depth}. Attendu un entier entre ${MIN_DEPTH} et ${MAX_DEPTH}.`
    );
  }

  const cuts: { index: number; title: string }[] = [];
  for (const match of markdown.matchAll(HEADING)) {
    if (match[1].length === depth) {
      cuts.push({ index: match.index, title: match[2].trim() });
    }
  }

  if (cuts.length === 0) {
    return { chapterProse: markdown, children: [] };
  }

  const used = new Set<string>();
  const children = cuts.map((cut, i) => ({
    title: cut.title,
    key: uniqueKey(parentKey, cut.title, i, used),
    prose: markdown.slice(cut.index, cuts[i + 1]?.index ?? markdown.length),
  }));

  return { chapterProse: markdown.slice(0, cuts[0].index), children };
}

/**
 * Cle stable, derivee du titre. Un titre repete dans un meme chapitre
 * (« Exemple », « Exemple ») recoit un suffixe plutot que d'ecraser le
 * precedent en silence — meme mecanisme de collision que les slugs de
 * monde et d'entite.
 */
function uniqueKey(parentKey: string, title: string, position: number, used: Set<string>): string {
  const base = slugify(title);
  const root = `${parentKey}-${base === "" ? `section-${position + 1}` : base}`;
  let candidate = root;
  let attempt = 1;
  while (used.has(candidate)) {
    candidate = nextSlugCandidate(root, attempt);
    attempt += 1;
  }
  used.add(candidate);
  return candidate;
}
