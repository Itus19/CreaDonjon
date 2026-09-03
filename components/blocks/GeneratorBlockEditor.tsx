"use client";

import { useState } from "react";
import type { GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { isProseSlot, PROSE_LENGTH_PRESETS, DEFAULT_PROSE_LENGTH, type ProseLength } from "@/src/core/generators/types";

interface GeneratedResult {
  text: string;
}

/**
 * Editeur du bloc `generator` (V1-E2/V2-J1, specs/outils-mj.md §3) — meme
 * precedent que `RandomTableBlockEditor.tsx` : toujours editable en place,
 * porte aussi la generation elle-meme (bouton « Générer »). Un emplacement
 * `table` designe la CLE d'un bloc `random_table` de la meme entite (pas de
 * selecteur d'entite/ruleset — cf. la meme portee reduite que la cascade de
 * V1-E1) ; un emplacement `prose` (V2-J1) porte une consigne redigee par
 * l'IA a partir des emplacements `table` deja tires. Le gabarit assemble
 * les textes, table et prose confondus, via `{cle}`.
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
  const [proseLength, setProseLength] = useState<ProseLength>(DEFAULT_PROSE_LENGTH);

  function updateTableSlot(index: number, patch: { key?: string; table?: string }) {
    onChange({
      ...data,
      slots: data.slots.map((s, i) => (i === index && !isProseSlot(s) ? { ...s, ...patch } : s)),
    });
  }

  function updateProseSlot(index: number, patch: { key?: string; prose?: string }) {
    onChange({
      ...data,
      slots: data.slots.map((s, i) => (i === index && isProseSlot(s) ? { ...s, ...patch } : s)),
    });
  }

  function removeSlot(index: number) {
    onChange({ ...data, slots: data.slots.filter((_, i) => i !== index) });
  }

  function addTableSlot() {
    onChange({ ...data, slots: [...data.slots, { key: "", table: "" }] });
  }

  function addProseSlot() {
    onChange({ ...data, slots: [...data.slots, { key: "", prose: "" }] });
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/blocks/${blockId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proseLength }),
    });
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
        {data.slots.map((slot, index) =>
          isProseSlot(slot) ? (
            <div key={index} className="flex items-start gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
              <span className="mt-1 rounded-full border border-accent/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">prose</span>
              <input
                value={slot.key}
                onChange={(e) => updateProseSlot(index, { key: e.target.value })}
                placeholder="clé (ex. ambiance_desc)"
                className="w-32 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
              <textarea
                value={slot.prose}
                onChange={(e) => updateProseSlot(index, { prose: e.target.value })}
                placeholder="Consigne pour l'IA (ex. « Décris l'ambiance de cette taverne »)"
                rows={2}
                className="flex-1 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
              <button type="button" onClick={() => removeSlot(index)} className="mt-1 text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          ) : (
            <div key={index} className="flex items-center gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
              <span className="rounded-full border border-edge/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">table</span>
              <input
                value={slot.key}
                onChange={(e) => updateTableSlot(index, { key: e.target.value })}
                placeholder="clé (ex. prenom)"
                className="w-32 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
              <span className="text-xs text-ink-muted">→ table</span>
              <input
                value={slot.table}
                onChange={(e) => updateTableSlot(index, { table: e.target.value })}
                placeholder="clé de la table"
                className="flex-1 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
              <button type="button" onClick={() => removeSlot(index)} className="text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          )
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={addTableSlot}
            className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            + Emplacement table
          </button>
          <button
            type="button"
            onClick={addProseSlot}
            className="self-start rounded-full border border-accent/60 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
          >
            + Emplacement prose (IA)
          </button>
        </div>
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
        <div className="flex flex-wrap items-center gap-2">
          {data.slots.some(isProseSlot) && (
            <div className="flex items-center gap-1 text-xs text-ink-muted">
              Longueur :
              {PROSE_LENGTH_PRESETS.map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => setProseLength(length)}
                  className={`rounded-full border px-2 py-0.5 transition-colors ${
                    proseLength === length ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {length} mots
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="self-start rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {generating ? "Génération…" : "Générer"}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {result && (
          <p className="rounded-md border border-edge/60 bg-panel-sunken p-2 text-sm text-ink">{result.text}</p>
        )}
      </div>
    </div>
  );
}
