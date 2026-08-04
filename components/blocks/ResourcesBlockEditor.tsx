"use client";

import Dropdown from "@/components/shared/Dropdown";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";

type Tracker = ResourcesBlockData["trackers"][number];

function trackerMax(t: Tracker): number {
  return t.max.formula.op === "num" ? t.max.formula.value : 0;
}

const RECHARGE_OPTIONS = [
  { value: "short_rest", label: "Repos court" },
  { value: "long_rest", label: "Repos long" },
  { value: "dawn", label: "A l'aube" },
  { value: "never", label: "Jamais (usage unique)" },
];

/**
 * Le maximum est une formule (le moteur peut le faire dependre du niveau),
 * mais cet editeur ne pose qu'un nombre constant : une formule complete
 * (avec `level` en reference) n'a pas encore d'editeur dedie dans le wiki —
 * seule la table de progression des regles en produit aujourd'hui.
 */
export default function ResourcesBlockEditor({
  data,
  onChange,
}: {
  data: ResourcesBlockData;
  onChange: (data: ResourcesBlockData) => void;
}) {
  function updateTracker(index: number, patch: Partial<Tracker>) {
    onChange({ ...data, trackers: data.trackers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }
  function removeTracker(index: number) {
    onChange({ ...data, trackers: data.trackers.filter((_, i) => i !== index) });
  }
  function addTracker() {
    onChange({
      ...data,
      trackers: [
        ...data.trackers,
        { id: crypto.randomUUID(), label: "", max: { formula: { op: "num", value: 1 } }, recharge: "short_rest", custom: true },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {data.trackers.map((tracker, index) => (
        <div key={tracker.id} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
          <input
            value={tracker.label}
            onChange={(e) => updateTracker(index, { label: e.target.value })}
            placeholder="Second souffle"
            className="w-40 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
          <input
            type="number"
            min={0}
            value={trackerMax(tracker)}
            onChange={(e) => updateTracker(index, { max: { formula: { op: "num", value: Number(e.target.value) || 0 } } })}
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            aria-label="Maximum"
          />
          <Dropdown
            value={tracker.recharge}
            options={RECHARGE_OPTIONS}
            onChange={(v) => updateTracker(index, { recharge: v as Tracker["recharge"] })}
            aria-label="Recuperation"
          />
          <button type="button" onClick={() => removeTracker(index)} className="text-xs text-danger hover:underline">
            ×
          </button>
        </div>
      ))}
      {data.trackers.length === 0 && <p className="text-sm text-ink-muted">Aucun compteur pour l&apos;instant.</p>}
      <button
        type="button"
        onClick={addTracker}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter un compteur
      </button>
    </div>
  );
}
