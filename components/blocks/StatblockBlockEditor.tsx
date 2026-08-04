"use client";

import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";

type Entry = { name: string; text: string };
type EntryListKey = "traits" | "actions" | "reactions" | "legendary_actions";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ENTRY_LIST_LABELS: Record<EntryListKey, string> = {
  traits: "Traits",
  actions: "Actions",
  reactions: "Reactions",
  legendary_actions: "Actions legendaires",
};

function EntryList({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{title}</span>
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-col gap-1 border-b border-edge/40 py-1.5">
          <div className="flex items-center gap-2">
            <input
              value={entry.name}
              onChange={(e) => onChange(entries.map((en, i) => (i === index ? { ...en, name: e.target.value } : en)))}
              placeholder="Nom"
              className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              className="text-xs text-danger hover:underline"
            >
              ×
            </button>
          </div>
          <textarea
            value={entry.text}
            onChange={(e) => onChange(entries.map((en, i) => (i === index ? { ...en, text: e.target.value } : en)))}
            rows={2}
            className="bg-transparent text-sm text-ink outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...entries, { name: "", text: "" }])}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter
      </button>
    </div>
  );
}

/**
 * Bloc `statblock` (V1-B2) : valeurs plates, saisies directement — pas de
 * build, pas de recalcul. Un gobelin n'a pas fait de choix de classe
 * (specs/wiki-blocs.md §4.1, §5).
 */
export default function StatblockBlockEditor({
  data,
  onChange,
}: {
  data: StatblockBlockData;
  onChange: (data: StatblockBlockData) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Taille
          <input
            value={data.size}
            onChange={(e) => onChange({ ...data, size: e.target.value })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Type
          <input
            value={data.creature_type}
            onChange={(e) => onChange({ ...data, creature_type: e.target.value })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Alignement
          <input
            value={data.alignment ?? ""}
            onChange={(e) => onChange({ ...data, alignment: e.target.value || undefined })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Vitesse
          <input
            value={data.speed}
            onChange={(e) => onChange({ ...data, speed: e.target.value })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          CA
          <input
            type="number"
            value={data.ac.value}
            onChange={(e) => onChange({ ...data, ac: { ...data.ac, value: Number(e.target.value) || 0 } })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Source CA
          <input
            value={data.ac.source ?? ""}
            onChange={(e) => onChange({ ...data, ac: { ...data.ac, source: e.target.value || undefined } })}
            placeholder="armure naturelle"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          PV
          <input
            type="number"
            value={data.hp.value}
            onChange={(e) => onChange({ ...data, hp: { ...data.hp, value: Number(e.target.value) || 0 } })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Des de vie
          <input
            value={data.hp.hit_dice ?? ""}
            onChange={(e) => onChange({ ...data, hp: { ...data.hp, hit_dice: e.target.value || undefined } })}
            placeholder="2d6"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => (
          <label key={ability} className="flex flex-col gap-1 text-xs text-ink-muted">
            {ability.toUpperCase()}
            <input
              type="number"
              value={data.abilities[ability]}
              onChange={(e) => onChange({ ...data, abilities: { ...data.abilities, [ability]: Number(e.target.value) || 0 } })}
              className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Sens
          <input
            value={data.senses ?? ""}
            onChange={(e) => onChange({ ...data, senses: e.target.value || undefined })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Langues
          <input
            value={data.languages ?? ""}
            onChange={(e) => onChange({ ...data, languages: e.target.value || undefined })}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Facteur de puissance
          <input
            value={data.challenge_rating ?? ""}
            onChange={(e) => onChange({ ...data, challenge_rating: e.target.value || undefined })}
            placeholder="1/4"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
      </div>

      {(Object.keys(ENTRY_LIST_LABELS) as EntryListKey[]).map((key) => (
        <EntryList
          key={key}
          title={ENTRY_LIST_LABELS[key]}
          entries={data[key]}
          onChange={(entries) => onChange({ ...data, [key]: entries })}
        />
      ))}
    </div>
  );
}
