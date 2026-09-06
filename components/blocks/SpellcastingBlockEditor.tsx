"use client";

import { useMemo } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import ReferenceChipDisplay from "./ReferenceChipDisplay";
import RuleEntryAutocomplete from "./RuleEntryAutocomplete";
import Checkbox from "@/components/shared/Checkbox";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const SPELL_TYPES = ["spell"] as const;

export default function SpellcastingBlockEditor({
  data,
  onChange,
  worldSlug,
}: {
  data: SpellcastingBlockData;
  onChange: (data: SpellcastingBlockData) => void;
  worldSlug: string;
}) {
  const refsToResolve = useMemo(() => data.known.map((k) => k.ref), [data.known]);
  const chips = useReferenceChips(worldSlug, refsToResolve);

  function updateSource(index: number, patch: Partial<SpellcastingBlockData["sources"][number]>) {
    onChange({ ...data, sources: data.sources.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }
  function removeSource(index: number) {
    onChange({ ...data, sources: data.sources.filter((_, i) => i !== index) });
  }
  function addSource() {
    onChange({ ...data, sources: [...data.sources, { class: "", ability: "int" }] });
  }

  function updateKnown(index: number, key: string) {
    onChange({ ...data, known: data.known.map((k, i) => (i === index ? { ...k, ref: { kind: "rule", key } } : k)) });
  }
  function removeKnown(index: number) {
    onChange({ ...data, known: data.known.filter((_, i) => i !== index) });
  }
  function addKnown() {
    onChange({ ...data, known: [...data.known, { ref: { kind: "rule", key: "" }, origin: "spellbook" }] });
  }

  function togglePrepared(key: string) {
    const prepared = data.prepared.includes(key) ? data.prepared.filter((k) => k !== key) : [...data.prepared, key];
    onChange({ ...data, prepared });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sources d&apos;incantation</span>
        {data.sources.map((source, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
            <input
              value={source.class}
              onChange={(e) => updateSource(index, { class: e.target.value })}
              placeholder="wizard"
              className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <Dropdown
              value={source.ability}
              options={ABILITIES.map((a) => ({ value: a, label: a.toUpperCase() }))}
              onChange={(v) => updateSource(index, { ability: v as (typeof ABILITIES)[number] })}
              aria-label="Caracteristique d'incantation"
            />
            <button type="button" onClick={() => removeSource(index)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSource}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter une source
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sorts connus</span>
        {data.known.map((k, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
            <div className="w-32">
              <RuleEntryAutocomplete
                worldSlug={worldSlug}
                entryTypes={SPELL_TYPES}
                value={k.ref.kind === "rule" ? k.ref.key : ""}
                onChange={(key) => updateKnown(index, key)}
                placeholder="fireball"
              />
            </div>
            <ReferenceChipDisplay reference={k.ref} chip={chips.get(refIdentity(k.ref))} />
            <Checkbox
              checked={k.ref.kind === "rule" && data.prepared.includes(k.ref.key)}
              onChange={() => k.ref.kind === "rule" && togglePrepared(k.ref.key)}
              label="Prepare"
              className="gap-1 text-xs text-ink-muted"
            />
            <button type="button" onClick={() => removeKnown(index)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addKnown}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un sort
        </button>
      </div>

      <p className="text-xs italic text-ink-muted">
        Les emplacements de sort sont derives de la table de progression de la classe — rien a saisir ici, sauf
        surcharge exceptionnelle (non exposee dans cet editeur pour l&apos;instant).
      </p>
    </div>
  );
}
