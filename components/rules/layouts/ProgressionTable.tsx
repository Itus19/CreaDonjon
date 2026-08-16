import type { ReactNode } from "react";

type Column = { key: string; label: string; align?: "left" | "center"; group?: string };

const HEADER_CELL = "py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted";

/**
 * Premiere ligne d'en-tete quand au moins une colonne porte `group` (V1-D7,
 * retour utilisateur : "Emplacements" au-dessus de "Niv. 1"/"Niv. 2"/...
 * plutot que repeter le mot a chaque colonne, pour retrecir la table).
 * Colonnes consecutives partageant le meme `group` fusionnees en un seul
 * `colSpan` ; une colonne sans groupe s'etire sur les deux lignes
 * (`rowSpan`) plutot que de dupliquer son libelle sur la seconde ligne.
 */
function buildGroupedHeaderRow(columns: Column[]) {
  const cells: { key: string; label: string; span: number; isGroup: boolean }[] = [];
  for (const col of columns) {
    const prev = cells[cells.length - 1];
    if (col.group && prev?.isGroup && prev.label === col.group) {
      prev.span += 1;
    } else if (col.group) {
      cells.push({ key: col.key, label: col.group, span: 1, isGroup: true });
    } else {
      cells.push({ key: col.key, label: col.label, span: 1, isGroup: false });
    }
  }
  return cells;
}

/**
 * Mise en page `progression_table` (specs/regles-blocs.md §4, §7) :
 * colonnes declarees, lignes en donnees. `align` (V1-D7, sur retour
 * utilisateur — les niveaux de `SubclassFeatures` devaient etre centres
 * sous leur en-tete) optionnel par colonne, `left` par defaut : n'affecte
 * que la colonne qui le demande, les tables existantes (`class_progression`,
 * `scaling`) gardent leur alignement actuel sans y toucher.
 */
export default function ProgressionTable({ columns, rows }: { columns: Column[]; rows: { key: string; value: ReactNode }[][] }) {
  const alignByKey = new Map(columns.map((col) => [col.key, col.align ?? "left"]));
  const hasGroups = columns.some((col) => col.group);
  const groupedRow = hasGroups ? buildGroupedHeaderRow(columns) : [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          {hasGroups ? (
            <>
              <tr>
                {groupedRow.map((cell) => (
                  <th key={cell.key} colSpan={cell.span} rowSpan={cell.isGroup ? 1 : 2} className={`${HEADER_CELL} text-center`}>
                    {cell.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-edge/60">
                {columns
                  .filter((col) => col.group)
                  .map((col) => (
                    <th key={col.key} className={`${HEADER_CELL} text-center`}>
                      {col.label}
                    </th>
                  ))}
              </tr>
            </>
          ) : (
            <tr className="border-b border-edge/60">
              {columns.map((col) => (
                <th key={col.key} className={`${HEADER_CELL} ${col.align === "center" ? "text-center" : ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          )}
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
