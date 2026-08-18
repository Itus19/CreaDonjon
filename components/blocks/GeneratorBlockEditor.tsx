"use client";

import { useState } from "react";
import type { GeneratorBlockData } from "@/src/core/schemas/blocks/generator";

interface GeneratedResult {
  text: string;
}

/**
 * Editeur du bloc `generator` (V1-E2, specs/outils-mj.md §3) — meme
 * precedent que `RandomTableBlockEditor.tsx` : toujours editable en place,
 * porte aussi la generation elle-meme (bouton « Générer »). Chaque
 * emplacement designe la CLE d'un bloc `random_table` de la meme entite
 * (pas de selecteur d'entite/ruleset — cf. la meme portee reduite que la
 * cascade de V1-E1) ; le gabarit assemble les textes tires via `{cle}`.
 */
export default function GeneratorBlockEditor({
  data,
  onChange,
  blockId,
}: {
  data: GeneratorBlockData;
  onChange: (data: GeneratorBlockData) => void;
  blockId: string;
}) {
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function updateSlot(index: number, patch: Partial<GeneratorBlockData["slots"][number]>) {
    onChange({ ...data, slots: data.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }

  function removeSlot(index: number) {
    onChange({ ...data, slots: data.slots.filter((_, i) => i !== index) });
  }

  function addSlot() {
    onChange({ ...data, slots: [...data.slots, { key: "", table: "" }] });
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/blocks/${blockId}/generate`, { method: "POST" });
    setGenerating(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible de générer — réessayez.");
      setResult(null);
      return;
    }
    const body = (await res.json()) as GeneratedResult;
    setResult(body);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {data.slots.map((slot, index) => (
          <div key={index} className="flex items-center gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
            <input
              value={slot.key}
              onChange={(e) => updateSlot(index, { key: e.target.value })}
              placeholder="clé (ex. prenom)"
              className="w-32 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
            />
            <span className="text-xs text-ink-muted">→ table</span>
            <input
              value={slot.table}
              onChange={(e) => updateSlot(index, { table: e.target.value })}
              placeholder="clé de la table"
              className="flex-1 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
            />
            <button type="button" onClick={() => removeSlot(index)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSlot}
          className="mt-2 self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un emplacement
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Gabarit
        <textarea
          value={data.template}
          onChange={(e) => onChange({ ...data, template: e.target.value })}
          placeholder="{prenom} le {trait}"
          rows={3}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-2 border-t border-edge/60 pt-3">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="self-start rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {generating ? "Génération…" : "Générer"}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
        {result && (
          <p className="rounded-md border border-edge/60 bg-panel-sunken p-2 text-sm text-ink">{result.text}</p>
        )}
      </div>
    </div>
  );
}
