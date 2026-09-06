"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import EyeIcon from "@/components/shared/EyeIcon";
import GameDateInput from "@/components/shared/GameDateInput";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { useWorldCalendar } from "@/components/shared/useWorldCalendar";
import type { GameDate } from "@/src/core/calendar/types";
import { RELATIONSHIP_AXIS_KEYS, type RelationshipAxisKey } from "@/src/core/psyche/keys";
import Checkbox from "@/components/shared/Checkbox";

const BLANK_DATE: GameDate = { year: 0, month: null, day: null, precision: "year", end: null, label: null };

const AXIS_LABELS_FR: Record<RelationshipAxisKey, string> = {
  trust_distrust: "Confiance ↔ Méfiance",
  friendship_hostility: "Amitié ↔ Hostilité",
  respect_contempt: "Respect ↔ Mépris",
  attraction_repulsion: "Attirance ↔ Répulsion",
  debt_independence: "Dette ↔ Indépendance",
  fear_assurance: "Peur ↔ Assurance",
  interest_indifference: "Intérêt ↔ Indifférence",
};

interface AttitudeEventInfo {
  id: string;
  summary: string;
  deltas: Partial<Record<RelationshipAxisKey, number>>;
  occurred_at_ingame: GameDate | null;
  created_at: string;
  is_public: boolean;
}

function formatDeltas(deltas: Partial<Record<RelationshipAxisKey, number>>): string {
  return Object.entries(deltas)
    .map(([key, delta]) => `${AXIS_LABELS_FR[key as RelationshipAxisKey].split(" ↔ ")[0]} ${delta! > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/** Tableau de souvenirs d'UNE relation (V2-H1) — historique par paire, jamais global (specs/psyche-pnj.md §4). */
export default function RelationshipEventTable({
  sourceEntityId,
  targetEntityId,
  worldSlug,
  onAxesChanged,
  reloadSignal,
}: {
  sourceEntityId: string;
  targetEntityId: string;
  worldSlug: string;
  onAxesChanged: (axes: Partial<Record<RelationshipAxisKey, number>>) => void;
  /** Incremente par le parent apres un curseur deplace a la main (meme souvenir, ecrit ailleurs) — force le rechargement de la liste. Bug reel trouve en verifiant ce bloc : sans ca, un souvenir cree par le curseur n'apparaissait jamais dans ce tableau tant qu'on ne changeait pas de cible ou ne rechargeait pas la page. */
  reloadSignal?: number;
}) {
  const [events, setEvents] = useState<AttitudeEventInfo[]>([]);
  const [summary, setSummary] = useState("");
  const [hasIngameDate, setHasIngameDate] = useState(false);
  const [occurredAtIngame, setOccurredAtIngame] = useState<GameDate>(BLANK_DATE);
  const activeCalendar = useWorldCalendar(worldSlug);
  const [rows, setRows] = useState<{ id: string; key: RelationshipAxisKey; delta: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function loadEvents() {
    fetch(`/api/entities/${sourceEntityId}/attitudes/${targetEntityId}/events`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents);
  }

  useEffect(loadEvents, [sourceEntityId, targetEntityId, reloadSignal]);

  /** Bascule "afficher au wiki" (V2, retour utilisateur point 5) — meme geste que PersonalityEventTable.tsx, table `attitude_events`. */
  async function toggleEventPublic(event: AttitudeEventInfo) {
    const next = !event.is_public;
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_public: next } : e)));
    await fetch(`/api/attitude-events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), key: RELATIONSHIP_AXIS_KEYS[0], delta: "" }]);
  }
  function updateRow(id: string, patch: Partial<{ key: RelationshipAxisKey; delta: string }>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function submit() {
    const deltas: Partial<Record<RelationshipAxisKey, number>> = {};
    for (const row of rows) {
      const n = Number(row.delta);
      if (row.delta.trim() !== "" && Number.isFinite(n) && n !== 0) deltas[row.key] = n;
    }
    if (!summary.trim() || Object.keys(deltas).length === 0) {
      setError("Une description et au moins un axe touché sont requis.");
      return;
    }

    setPending(true);
    setError(null);
    const res = await fetch(`/api/entities/${sourceEntityId}/attitude-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetEntityId,
        summary: summary.trim(),
        deltas,
        occurredAtIngame: hasIngameDate ? occurredAtIngame : null,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajouter ce souvenir.");
      return;
    }
    const body = (await res.json()) as { axes: Partial<Record<RelationshipAxisKey, number>> };
    onAxesChanged(body.axes);
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
              <th className="py-1 pr-4">Wiki</th>
              <th className="py-1 pr-4">Date IRL</th>
              <th className="py-1 pr-4">Date ingame</th>
              <th className="py-1 pr-4">Événement</th>
              <th className="py-1 pr-4">Effet</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-edge/30 align-top">
                <td className="py-1.5 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleEventPublic(event)}
                    className="text-ink-muted hover:text-ink"
                    aria-label={event.is_public ? "Masquer ce souvenir au wiki public" : "Afficher ce souvenir au wiki public"}
                    title={event.is_public ? "Visible au wiki public — cliquer pour masquer" : "Masqué au wiki public — cliquer pour afficher"}
                  >
                    <EyeIcon open={event.is_public} className="h-3.5 w-3.5" />
                  </button>
                </td>
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
                <td colSpan={5} className="py-2 text-xs italic text-ink-muted">
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
            placeholder="A insulté un passant devant elle…"
            className="min-w-[240px] flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </div>
        <Checkbox
          checked={hasIngameDate}
          onChange={() => setHasIngameDate(!hasIngameDate)}
          label="Date ingame connue"
          className="text-xs text-ink-muted"
        />
        {hasIngameDate && (
          <GameDateInput calendar={activeCalendar} value={occurredAtIngame} onChange={setOccurredAtIngame} />
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Dropdown
              value={row.key}
              options={RELATIONSHIP_AXIS_KEYS.map((k) => ({ value: k, label: AXIS_LABELS_FR[k] }))}
              onChange={(v) => updateRow(row.id, { key: v as RelationshipAxisKey })}
              aria-label="Axe touché"
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
            + Axe touché
          </button>
          <button
            type="button"
            onClick={submit}
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
