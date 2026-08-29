"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import GameDateInput from "@/components/shared/GameDateInput";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import type { GameDate } from "@/src/core/calendar/types";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";

const BLANK_DATE: GameDate = { year: 0, month: null, day: null, precision: "year", end: null, label: null };

const POLE_LABELS_FR: Record<PersonalityPoleKey, string> = {
  curiosity_caution: "Curiosité ↔ Prudence",
  altruism_selfishness: "Altruisme ↔ Égoïsme",
  empathy_hardness: "Empathie ↔ Dureté",
  impulse_prudence: "Impulsivité ↔ Prudence",
  extraversion_reserve: "Extraversion ↔ Réserve",
  authority_independence: "Autorité ↔ Indépendance",
};

interface PersonalityEventInfo {
  id: string;
  summary: string;
  deltas: Partial<Record<PersonalityPoleKey, number>>;
  occurred_at_ingame: GameDate | null;
  created_at: string;
}

function formatDeltas(deltas: Partial<Record<PersonalityPoleKey, number>>): string {
  return Object.entries(deltas)
    .map(([key, delta]) => `${POLE_LABELS_FR[key as PersonalityPoleKey].split(" ↔ ")[0]} ${delta! > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/**
 * Tableau de souvenirs sous le radar (V2-H1) — un souvenir peut toucher
 * plusieurs poles a la fois. Delta > 40 en valeur absolue : confirmation
 * cote client (avant envoi) ET cote serveur (`addPersonalityEvent`,
 * defense en profondeur).
 */
export default function PersonalityEventTable({
  entityId,
  blockId,
  version,
  worldSlug,
  onBlockRefreshed,
  reloadSignal,
}: {
  entityId: string;
  blockId: string;
  version: number;
  worldSlug: string;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Incremente par le parent apres un curseur deplace a la main (meme journal, ecrit ailleurs) — force le rechargement de la liste. */
  reloadSignal?: number;
}) {
  const [events, setEvents] = useState<PersonalityEventInfo[]>([]);
  const [summary, setSummary] = useState("");
  const [hasIngameDate, setHasIngameDate] = useState(false);
  const [occurredAtIngame, setOccurredAtIngame] = useState<GameDate>(BLANK_DATE);
  const [calendar, setCalendar] = useState<CalendarConfigInput | null>(null);
  const [rows, setRows] = useState<{ id: string; key: PersonalityPoleKey; delta: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function loadEvents() {
    fetch(`/api/entities/${entityId}/personality-events`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents);
  }

  useEffect(loadEvents, [entityId, reloadSignal]);

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

  function addRow() {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), key: PERSONALITY_POLE_KEYS[0], delta: "" }]);
  }
  function updateRow(id: string, patch: Partial<{ key: PersonalityPoleKey; delta: string }>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function submit(confirmed = false) {
    const deltas: Partial<Record<PersonalityPoleKey, number>> = {};
    for (const row of rows) {
      const n = Number(row.delta);
      if (row.delta.trim() !== "" && Number.isFinite(n) && n !== 0) deltas[row.key] = n;
    }
    if (!summary.trim() || Object.keys(deltas).length === 0) {
      setError("Une description et au moins un pôle touché sont requis.");
      return;
    }
    if (!confirmed) {
      const hasLarge = Object.values(deltas).some((d) => Math.abs(d as number) > 40);
      if (hasLarge && !window.confirm("Ce changement est important (> 40). Confirmer ?")) return;
    }

    setPending(true);
    setError(null);
    const res = await fetch(`/api/blocks/${blockId}/personality-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        summary: summary.trim(),
        deltas,
        occurredAtIngame: hasIngameDate ? occurredAtIngame : null,
        confirmed: true,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajouter ce souvenir.");
      return;
    }
    const body = (await res.json()) as { block: { id: string; data: unknown; version: number } };
    onBlockRefreshed(body.block);
    setSummary("");
    setHasIngameDate(false);
    setOccurredAtIngame(BLANK_DATE);
    setRows([]);
    loadEvents();
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Souvenirs</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-edge/60 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              <th className="py-1 pr-4">Date IRL</th>
              <th className="py-1 pr-4">Date ingame</th>
              <th className="py-1 pr-4">Événement</th>
              <th className="py-1 pr-4">Effet</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-edge/30 align-top">
                <td className="whitespace-nowrap py-1.5 pr-4 text-xs text-ink-muted">
                  {new Date(event.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-4 text-xs text-ink-muted">
                  {event.occurred_at_ingame ? formatGameDate(event.occurred_at_ingame, activeCalendar) : "—"}
                </td>
                <td className="py-1.5 pr-4">{event.summary}</td>
                <td className="py-1.5 pr-4 text-xs text-ink-muted">{formatDeltas(event.deltas)}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-xs italic text-ink-muted">
                  Aucun souvenir pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge p-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A vu une personne mourir devant ses yeux…"
            className="min-w-[240px] flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <input type="checkbox" checked={hasIngameDate} onChange={(e) => setHasIngameDate(e.target.checked)} />
          Date ingame connue
        </label>
        {hasIngameDate && (
          <GameDateInput calendar={activeCalendar} value={occurredAtIngame} onChange={setOccurredAtIngame} />
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Dropdown
              value={row.key}
              options={PERSONALITY_POLE_KEYS.map((k) => ({ value: k, label: POLE_LABELS_FR[k] }))}
              onChange={(v) => updateRow(row.id, { key: v as PersonalityPoleKey })}
              aria-label="Pôle touché"
            />
            <input
              type="number"
              value={row.delta}
              onChange={(e) => updateRow(row.id, { delta: e.target.value })}
              placeholder="+10"
              className="w-20 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
            />
            <button type="button" onClick={() => removeRow(row.id)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            + Pôle touché
          </button>
          <button
            type="button"
            onClick={() => submit()}
            disabled={pending}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Ajouter le souvenir
          </button>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      </div>
    </div>
  );
}
