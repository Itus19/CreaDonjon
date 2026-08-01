import type { ReactNode } from "react";

/** Mise en page `progression_table` (specs/regles-blocs.md §4, §7) : colonnes declarees, lignes en donnees. */
export default function ProgressionTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: { key: string; value: ReactNode }[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60">
            {columns.map((col) => (
              <th key={col.key} className="py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/30">
              {row.map((cell) => (
                <td key={cell.key} className="py-1 pr-4">
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
