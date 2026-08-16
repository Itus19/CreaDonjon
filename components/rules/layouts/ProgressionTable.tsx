import type { ReactNode } from "react";

/**
 * Mise en page `progression_table` (specs/regles-blocs.md §4, §7) :
 * colonnes declarees, lignes en donnees. `align` (V1-D7, sur retour
 * utilisateur — les niveaux de `SubclassFeatures` devaient etre centres
 * sous leur en-tete) optionnel par colonne, `left` par defaut : n'affecte
 * que la colonne qui le demande, les tables existantes (`class_progression`,
 * `scaling`) gardent leur alignement actuel sans y toucher.
 */
export default function ProgressionTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "center" }[];
  rows: { key: string; value: ReactNode }[][];
}) {
  const alignByKey = new Map(columns.map((col) => [col.key, col.align ?? "left"]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted ${
                  col.align === "center" ? "text-center" : ""
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/30">
              {row.map((cell) => (
                <td key={cell.key} className={`py-1 pr-4 ${alignByKey.get(cell.key) === "center" ? "text-center" : ""}`}>
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
