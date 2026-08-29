"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { QUEST_STATE_LABELS_FR } from "@/src/i18n/fr";
import { QUEST_STATES, type QuestBlockData, type QuestNote, type QuestObjective } from "@/src/core/schemas/blocks/quest";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

const NO_ENTITY = "";

function newId(): string {
  return crypto.randomUUID();
}

function entityRefDropdown(
  ref: BlockReference | null | undefined,
  otherEntities: OtherEntityOption[],
  onChange: (ref: BlockReference | null) => void
) {
  const value = ref?.kind === "entity" ? ref.id : NO_ENTITY;
  return (
    <Dropdown
      value={value}
      options={[{ value: NO_ENTITY, label: "— aucune entité —" }, ...otherEntities.map((e) => ({ value: e.id, label: e.name }))]}
      onChange={(v) => onChange(v === NO_ENTITY ? null : { kind: "entity", id: v })}
      className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink-muted outline-none transition-colors hover:bg-panel-raised"
      aria-label="Entité liée"
    />
  );
}

export default function QuestBlockEditor({
  blockId,
  version,
  data,
  otherEntities,
  onChange,
  onBlockRefreshed,
}: {
  blockId: string;
  version: number;
  data: QuestBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: QuestBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [pendingObjectiveId, setPendingObjectiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleObjective(objective: QuestObjective) {
    setError(null);
    setPendingObjectiveId(objective.id);
    const res = await fetch(`/api/blocks/${blockId}/quest-objective`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, objectiveId: objective.id, done: !objective.done }),
    });
    setPendingObjectiveId(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible de mettre à jour cet objectif.");
      return;
    }
    const fresh = (await res.json()) as { id: string; data: unknown; version: number };
    onBlockRefreshed(fresh);
  }

  function addObjective() {
    onChange({ ...data, objectives: [...data.objectives, { id: newId(), text: "", done: false }] });
  }
  function updateObjective(id: string, patch: Partial<QuestObjective>) {
    onChange({ ...data, objectives: data.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }
  function removeObjective(id: string) {
    onChange({ ...data, objectives: data.objectives.filter((o) => o.id !== id) });
  }

  function noteList(key: "rewards" | "prerequisites", label: string, addLabel: string) {
    const items = data[key];
    function add() {
      onChange({ ...data, [key]: [...items, { id: newId(), text: "" }] });
    }
    function update(id: string, patch: Partial<QuestNote>) {
      onChange({ ...data, [key]: items.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
    }
    function remove(id: string) {
      onChange({ ...data, [key]: items.filter((n) => n.id !== id) });
    }
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        {items.map((note) => (
          <div key={note.id} className="flex items-center gap-2">
            <input
              value={note.text}
              onChange={(e) => update(note.id, { text: e.target.value })}
              placeholder="…"
              className="flex-1 bg-transparent text-sm text-ink outline-none"
            />
            {entityRefDropdown(note.ref, otherEntities, (ref) => update(note.id, { ref: ref ?? undefined }))}
            <button type="button" onClick={() => remove(note.id)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {addLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">État</span>
        <Dropdown
          value={data.state}
          options={QUEST_STATES.map((s) => ({ value: s, label: QUEST_STATE_LABELS_FR[s] }))}
          onChange={(v) => onChange({ ...data, state: v as QuestBlockData["state"] })}
          aria-label="État de la quête"
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Commanditaire</span>
        {entityRefDropdown(data.giver, otherEntities, (ref) => onChange({ ...data, giver: ref }))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Objectifs</span>
        {data.objectives.map((objective) => (
          <div key={objective.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={objective.done}
              disabled={pendingObjectiveId === objective.id}
              onChange={() => toggleObjective(objective)}
              className="h-4 w-4 accent-accent"
            />
            <input
              value={objective.text}
              onChange={(e) => updateObjective(objective.id, { text: e.target.value })}
              placeholder="…"
              className={`flex-1 bg-transparent text-sm outline-none ${objective.done ? "text-ink-muted line-through" : "text-ink"}`}
            />
            {entityRefDropdown(objective.ref, otherEntities, (ref) => updateObjective(objective.id, { ref: ref ?? undefined }))}
            <button
              type="button"
              onClick={() => removeObjective(objective.id)}
              className="text-xs text-danger hover:underline"
            >
              ×
            </button>
          </div>
        ))}
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="button"
          onClick={addObjective}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un objectif
        </button>
      </div>

      {noteList("rewards", "Récompenses", "+ Ajouter une récompense")}
      {noteList("prerequisites", "Prérequis", "+ Ajouter un prérequis")}
    </div>
  );
}
