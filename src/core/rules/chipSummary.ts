/**
 * Resume court d'une fiche de regle a partir de sa description traduite
 * (V1-C9, correctif) — utilise par `resolveRuleChips` quand la locale n'est
 * pas l'anglais.
 *
 * Pourquoi : le resume affiche sous chaque trait de l'onglet Traits venait
 * de `ai_digest`, une forme compressee generee a l'import depuis la source
 * anglaise (docs/SCHEMA.md §9.1, scripts/ingest-srd.ts) — donc anglaise,
 * meme quand la fiche possede une traduction francaise complete. La
 * traduction porte deja sa prose dans `ruleset_entry_translations.blocks
 * .description` ; il ne manquait que d'en tirer un resume, comme
 * `listRuleEntriesForWorld` en tire deja la description complete.
 *
 * `unknown` en entree : la valeur vient d'une colonne `jsonb`, elle n'est
 * garantie par rien avant d'etre lue (regle absolue 23 : on retrecit, on ne
 * suppose pas).
 */

/** Longueur visee : un resume de chip tient sur deux ou trois lignes sous le nom du trait, comme le faisait `ai_digest` (<= 120 jetons). Au-dela, l'encadre cesse d'etre un resume. */
export const CHIP_SUMMARY_MAX_LENGTH = 240;

interface DescriptionLike {
  segments?: unknown;
}

function firstSegmentText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const segments = (data as DescriptionLike).segments;
  if (!Array.isArray(segments)) return null;

  for (const segment of segments) {
    if (typeof segment !== "object" || segment === null) continue;
    const text = (segment as { text?: unknown }).text;
    if (typeof text !== "string") continue;
    // Espaces normalises : la prose du SRD est stockee avec ses retours a la
    // ligne d'origine, illisibles sur une ligne de resume.
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length > 0) return normalized;
  }
  return null;
}

/**
 * Rend le premier paragraphe de la description, tronque sur une frontiere de
 * mot. `null` — et non une chaine vide — quand il n'y a rien d'exploitable :
 * l'appelant doit pouvoir retomber sur `ai_digest` plutot que d'afficher du
 * blanc.
 */
export function chipSummaryFromDescription(data: unknown): string | null {
  const text = firstSegmentText(data);
  if (text === null) return null;
  if (text.length <= CHIP_SUMMARY_MAX_LENGTH) return text;

  const cut = text.slice(0, CHIP_SUMMARY_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  // Un mot unique plus long que la limite n'a pas de frontiere ou couper : on
  // coupe alors net plutot que de rendre le texte entier.
  const trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.…]+$/, "");
  return `${trimmed}…`;
}
