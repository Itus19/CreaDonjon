import { SeededRng } from "../dice/rng";
import { evaluate } from "../formula/evaluate";
import type { ClassProgressionBlockData } from "../schemas/rule-blocks/blocks";

/**
 * Calcule les colonnes kind:"formula" d'une table de progression
 * (specs/regles-blocs.md §7) a partir du niveau de chaque ligne — jamais
 * saisies vingt fois. Mode "average" : une colonne de table affiche une
 * valeur stable, jamais un jet ; la graine n'a donc aucun effet mais
 * `evaluate` exige un Rng (SCHEMA.md §20.3, jamais de Math.random() en dur).
 */
export function computeProgressionRows(data: ClassProgressionBlockData): Record<string, unknown>[] {
  const formulaColumns = data.columns.filter((c) => c.kind === "formula" && c.formula);
  if (formulaColumns.length === 0) return data.rows;

  const rng = new SeededRng(0);
  return data.rows.map((row) => {
    const level = Number(row.level ?? 0);
    const computed: Record<string, unknown> = { ...row };
    for (const col of formulaColumns) {
      computed[col.key] = evaluate(col.formula!, { level }, rng, "average").value;
    }
    return computed;
  });
}
