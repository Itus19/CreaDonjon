"use client";

import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";

export default function CustomTableBlockEditor({
  data,
  onChange,
}: {
  data: CustomTableBlockData;
  onChange: (data: CustomTableBlockData) => void;
}) {
  function renameColumn(index: number, name: string) {
    const oldName = data.columns[index];
    const columns = data.columns.map((c, i) => (i === index ? name : c));
    const rows = data.rows.map((row) => {
      const { [oldName]: value, ...rest } = row;
      return { ...rest, [name]: value };
    });
    onChange({ __v: 1, columns, rows });
  }

  function addColumn() {
    const name = `Colonne ${data.columns.length + 1}`;
    onChange({ __v: 1, columns: [...data.columns, name], rows: data.rows });
  }

  function removeColumn(index: number) {
    const name = data.columns[index];
    const columns = data.columns.filter((_, i) => i !== index);
    const rows = data.rows.map((row) => {
      const rest = { ...row };
      delete rest[name];
      return rest;
    });
    onChange({ __v: 1, columns, rows });
  }

  function updateCell(rowIndex: number, column: string, value: string) {
    const rows = data.rows.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row));
    onChange({ __v: 1, columns: data.columns, rows });
  }

  function addRow() {
    onChange({ __v: 1, columns: data.columns, rows: [...data.rows, {}] });
  }

  function removeRow(index: number) {
    onChange({ __v: 1, columns: data.columns, rows: data.rows.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {data.columns.map((column, index) => (
                <th key={index} className="border-b border-edge p-1 text-left">
                  <div className="flex items-center gap-1">
                    <input
                      value={column}
                      onChange={(e) => renameColumn(index, e.target.value)}
                      className="w-full rounded-md border border-edge bg-transparent px-2 py-1 text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
                      className="text-xs text-danger hover:underline"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="border-b border-edge p-1">
                <button
                  type="button"
                  onClick={addColumn}
                  className="rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  + Colonne
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {data.columns.map((column) => (
                  <td key={column} className="border-b border-edge/60 p-1">
                    <input
                      value={typeof row[column] === "string" ? (row[column] as string) : ""}
                      onChange={(e) => updateCell(rowIndex, column, e.target.value)}
                      className="w-full rounded-md border border-edge bg-transparent px-2 py-1 text-xs"
                    />
                  </td>
                ))}
                <td className="border-b border-edge/60 p-1">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="text-xs text-danger hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        disabled={data.columns.length === 0}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}
