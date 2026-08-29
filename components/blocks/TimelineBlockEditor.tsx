"use client";

import { useEffect, useRef, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import GameDateInput from "@/components/shared/GameDateInput";
import TimelineAxis from "@/components/entities/timeline/TimelineAxis";
import { computeSortKey } from "@/src/core/calendar/sortKey";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";
import { TIMELINE_ENTRY_KINDS, type TimelineBlockData, type TimelineEntry, type TimelineEntryKind } from "@/src/core/schemas/blocks/timeline";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

const KIND_LABELS_FR: Record<TimelineEntryKind, string> = {
  birth: "Naissance",
  death: "Mort",
  war: "Guerre",
  battle: "Bataille",
  founding: "Fondation",
  discovery: "Découverte",
  meeting: "Rencontre",
  oath: "Serment",
  betrayal: "Trahison",
  trauma: "Traumatisme",
  disaster: "Catastrophe",
  custom: "Autre",
};

function blankEntry(date: GameDate = { year: 0, month: null, day: null, precision: "year", end: null, label: null }): TimelineEntry {
  return {
    id: crypto.randomUUID(),
    date,
    kind: "custom",
    title: "",
    summary: "",
    visibility: { level: "public", scopeId: null },
  };
}

/**
 * Bloc `timeline` (V2-H2, specs/wiki-blocs.md §3) : entrees en ligne, une
 * chronologie parmi d'autres possibles sur la meme entite (vie d'un
 * personnage, histoire d'un monde...). Edition generique (onChange, meme
 * patron que les aspirations de `personality`) — aucun journal a ecrire
 * ici, contrairement aux poles psyche : une entree de timeline est du
 * contenu redactionnel, pas une mesure amortie.
 *
 * PAS de formulaire "brouillon" separe pour l'ajout : une premiere version
 * en avait un, avec un bouton "Ajouter" qui demontait le formulaire (donc
 * le champ alors focalise) au clic. `handleBlockBlur` (EntityBlocks.tsx)
 * ne sauvegarde QUE si le focus quitte reellement le conteneur du bloc —
 * une demolition du champ focalise ne declenche pas cet evenement de facon
 * fiable, l'entree disparaissait silencieusement au rechargement reel.
 * Corrige en ajoutant l'entree directement (comme les aspirations),
 * jamais via un etat local intermediaire qui disparait avant la sauvegarde.
 * Seule la promotion en entite passe par une route dediee (effet de bord
 * reel : cree une fiche).
 */
export default function TimelineBlockEditor({
  blockId,
  version,
  worldSlug,
  data,
  otherEntities,
  onChange,
  onBlockRefreshed,
}: {
  blockId: string;
  version: number;
  worldSlug: string;
  data: TimelineBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: TimelineBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [calendar, setCalendar] = useState<CalendarConfigInput | null>(null);
  const [entityLookup, setEntityLookup] = useState<Record<string, { name: string; slug: string }>>(() =>
    Object.fromEntries(otherEntities.map((e) => [e.id, { name: e.name, slug: e.slug }]))
  );
  const [pendingPromote, setPendingPromote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/worlds/${worldSlug}/calendar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { calendar: CalendarConfigInput } | null) => {
        if (!cancelled) setCalendar(body?.calendar ?? DEFAULT_CALENDAR);
      });
    return () => {
      cancelled = true;
    };
  }, [worldSlug]);

  const activeCalendar = calendar ?? DEFAULT_CALENDAR;

  const sorted = [...data.entries].sort(
    (a, b) => computeSortKey(a.date, activeCalendar) - computeSortKey(b.date, activeCalendar)
  );

  function updateEntry(id: string, patch: Partial<TimelineEntry>) {
    onChange({ ...data, entries: data.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }
  function removeEntry(id: string) {
    onChange({ ...data, entries: data.entries.filter((e) => e.id !== id) });
  }
  function addEntry() {
    onChange({ ...data, entries: [...data.entries, blankEntry()] });
  }

  /** Cree depuis l'axe (clic = point, glisse = periode avec `date.end`) — meme chemin d'ecriture que `addEntry`, juste avec une date deja calculee au lieu du reglage par defaut. */
  function createEntryAt(date: GameDate) {
    const entry = blankEntry(date);
    onChange({ ...data, entries: [...data.entries, entry] });
    setSelectedEntryId(entry.id);
    requestAnimationFrame(() => rowRefs.current[entry.id]?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function selectEntry(id: string) {
    setSelectedEntryId(id);
    rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function promote(entry: TimelineEntry) {
    setPendingPromote(entry.id);
    setError(null);
    const res = await fetch(`/api/blocks/${blockId}/timeline-promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, entryId: entry.id }),
    });
    setPendingPromote(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible de promouvoir cette entrée.");
      return;
    }
    const body = (await res.json()) as {
      entity: { id: string; name: string; slug: string };
      block: { id: string; data: unknown; version: number };
    };
    setEntityLookup((prev) => ({ ...prev, [body.entity.id]: { name: body.entity.name, slug: body.entity.slug } }));
    onBlockRefreshed(body.block);
  }

  return (
    <div className="flex flex-col gap-4">
      <TimelineAxis
        entries={data.entries}
        calendar={activeCalendar}
        selectedEntryId={selectedEntryId}
        onSelectEntry={selectEntry}
        onCreateEntry={createEntryAt}
      />

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-sm italic text-ink-muted">Aucun événement pour l&apos;instant.</p>}
        {sorted.map((entry) => {
          const linkedEntity = entry.ref?.kind === "entity" ? entityLookup[entry.ref.id] : undefined;
          return (
            <div
              key={entry.id}
              ref={(el) => {
                rowRefs.current[entry.id] = el;
              }}
              onClick={() => setSelectedEntryId(entry.id)}
              className={`flex flex-col gap-1.5 rounded border p-3 transition-colors ${
                entry.id === selectedEntryId ? "border-accent" : "border-edge"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Dropdown
                    value={entry.kind}
                    options={TIMELINE_ENTRY_KINDS.map((k) => ({ value: k, label: KIND_LABELS_FR[k] }))}
                    onChange={(v) => updateEntry(entry.id, { kind: v as TimelineEntryKind })}
                    aria-label="Genre de l'événement"
                  />
                  <span className="font-mono text-xs text-ink-muted">{formatGameDate(entry.date, activeCalendar)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Dropdown
                    value={entry.visibility.level}
                    options={VISIBILITY_OPTIONS}
                    onChange={(v) =>
                      updateEntry(entry.id, { visibility: { level: v as TimelineEntry["visibility"]["level"], scopeId: null } })
                    }
                    aria-label="Visibilité de l'événement"
                  />
                  <button type="button" onClick={() => removeEntry(entry.id)} className="text-xs text-danger hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>

              <input
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                placeholder="Titre de l'événement"
                className="bg-transparent text-sm font-semibold text-ink outline-none"
              />

              {entry.ref ? (
                linkedEntity && (
                  <a href={`/m/${worldSlug}/f/${linkedEntity.slug}`} className="text-xs text-accent hover:underline">
                    Voir la fiche « {linkedEntity.name} »
                  </a>
                )
              ) : (
                <>
                  <textarea
                    value={entry.summary}
                    onChange={(e) => updateEntry(entry.id, { summary: e.target.value })}
                    placeholder="Résumé (facultatif)"
                    rows={2}
                    className="bg-transparent text-sm text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => promote(entry)}
                    disabled={pendingPromote === entry.id || entry.title.trim() === ""}
                    className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
                  >
                    {pendingPromote === entry.id ? "Promotion…" : "Promouvoir en fiche"}
                  </button>
                </>
              )}

              <GameDateInput calendar={activeCalendar} value={entry.date} onChange={(date) => updateEntry(entry.id, { date })} />
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={addEntry}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter un événement
      </button>
    </div>
  );
}
