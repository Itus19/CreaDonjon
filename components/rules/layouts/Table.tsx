/** Mise en page `table` (specs/regles-blocs.md §4) : table generique, l'echappatoire `custom_table`. */
export default function Table({ columns, rows }: { columns: string[]; rows: Record<string, string>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60">
            {columns.map((col) => (
              <th key={col} className="py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/30">
              {columns.map((col) => (
                <td key={col} className="py-1 pr-4">
                  {row[col] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
