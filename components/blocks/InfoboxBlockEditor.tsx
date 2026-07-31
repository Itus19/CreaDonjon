"use client";

import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";

export default function InfoboxBlockEditor({
  data,
  onChange,
}: {
  data: InfoboxBlockData;
  onChange: (data: InfoboxBlockData) => void;
}) {
  function updateEntry(index: number, patch: Partial<InfoboxBlockData["entries"][number]>) {
    onChange({
      __v: 1,
      entries: data.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  }

  function removeEntry(index: number) {
    onChange({ __v: 1, entries: data.entries.filter((_, i) => i !== index) });
  }

  function addEntry() {
    onChange({ __v: 1, entries: [...data.entries, { label: "", value: "" }] });
  }

  return (
    <div className="flex flex-col gap-0.5">
      {data.entries.map((entry, index) => (
        <div
          key={index}
          className="flex items-baseline gap-3 border-b border-edge/40 py-1.5 last:border-b-0"
        >
          <input
            value={entry.label}
            onChange={(e) => updateEntry(index, { label: e.target.value })}
            placeholder="Population"
            className="w-32 shrink-0 bg-transparent text-xs font-semibold uppercase tracking-wider text-ink-muted outline-none placeholder:normal-case placeholder:tracking-normal focus:text-ink"
          />
          <input
            value={entry.value}
            onChange={(e) => updateEntry(index, { value: e.target.value })}
            placeholder="12 000"
            className="flex-1 bg-transparent text-sm text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => removeEntry(index)}
            className="text-xs text-danger hover:underline"
          >
            ×
          </button>
        </div>
      ))}
      {data.entries.length === 0 && (
        <p className="text-sm text-ink-muted">Aucune entree pour l&apos;instant.</p>
      )}
      <button
        type="button"
        onClick={addEntry}
        className="mt-2 self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter une entree
      </button>
    </div>
  );
}
