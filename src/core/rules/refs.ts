import type { ClassProgressionBlockData } from "../schemas/rule-blocks/blocks";

/**
 * Mêmes valeurs que la contrainte `ref_kind` de `ruleset_entry_refs`
 * (SCHEMA.md §9.3) — dupliquées ici plutôt qu'importées depuis une migration
 * SQL, qu'aucun module TypeScript ne peut lire.
 */
export const REF_KINDS = [
  "uses_rule",
  "applies_condition",
  "damage_type",
  "requires",
  "replaces",
  "see_also",
  "part_of",
  "grants",
] as const;
export type RefKind = (typeof REF_KINDS)[number];

export interface DerivedRef {
  target_key: string;
  ref_kind: RefKind;
  path: string;
}

/** Forme minimale d'un bloc necessaire a l'extraction — pas le type app complet (RuleEntryBlockView, EntryBlock), pour ne dependre d'aucun des deux. */
export interface RefExtractableBlock {
  block_type: string;
  data: unknown;
}

/**
 * Renvois déduits de la structure des blocs (SCHEMA.md §9.3) : jamais saisis
 * à la main, jamais reconstruits depuis du texte libre — un graphe entretenu
 * à la main diverge en trois semaines.
 *
 * Un seul cas produit aujourd'hui un renvoi fiable : une colonne `grants`
 * d'un `class_progression` qui accorde une `feature` à un niveau donné. C'est
 * le seul endroit où un champ structuré (pas du JSON brut d'import) porte
 * déjà une clé d'entrée stable. D'autres cas (sous-classe → classe, sort →
 * école...) s'ajouteront quand un bloc les portera réellement — règle des
 * trois, pas de renvoi vers une catégorie qui n'a pas de fiche à elle
 * (`Damage-Types`, `Magic-Schools`... voir SKIPPED_CATEGORIES).
 */
export function extractDerivedRefs(blocks: RefExtractableBlock[]): DerivedRef[] {
  const refs: DerivedRef[] = [];

  for (const block of blocks) {
    if (block.block_type !== "class_progression") continue;
    const data = block.data as ClassProgressionBlockData;
    const grantsColumns = data.columns.filter((c) => c.kind === "grants");
    if (grantsColumns.length === 0) continue;

    for (const col of grantsColumns) {
      for (const row of data.rows) {
        const grants = row[col.key];
        if (!Array.isArray(grants)) continue;

        grants.forEach((grant, i) => {
          const feature =
            grant && typeof grant === "object" ? (grant as { feature?: unknown }).feature : undefined;
          if (typeof feature !== "string") return;
          refs.push({
            target_key: feature,
            ref_kind: "grants",
            path: `blocks.class_progression.rows[${String(row.level)}].${col.key}[${i}]`,
          });
        });
      }
    }
  }

  return refs;
}
