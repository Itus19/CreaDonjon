"use client";

import { useEffect, useMemo, useState } from "react";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const DEFAULT_START = "19:00";
const DEFAULT_END = "23:00";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export interface AvailabilityMap {
  [date: string]: { startsAt: string; endsAt: string };
}

/**
 * Calendrier de disponibilités du joueur (V2.1-4, retour utilisateur : "sur
 * un an avant") — navigation mois par mois, une plage horaire par jour
 * (une seule, jamais plusieurs disjointes le même soir). La bande des 12
 * mois en bas sert à repérer d'un coup d'œil ceux déjà remplis, sans avoir
 * à tous les visiter.
 */
export default function AvailabilityCalendar({ campaignId }: { campaignId: string }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [availabilities, setAvailabilities] = useState<AvailabilityMap>({});
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState(DEFAULT_START);
  const [draftEnd, setDraftEnd] = useState(DEFAULT_END);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/scheduling/availability`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { availabilities: { date: string; starts_at: string; ends_at: string }[] }) => {
        const map: AvailabilityMap = {};
        for (const a of body.availabilities) map[a.date] = { startsAt: a.starts_at.slice(0, 5), endsAt: a.ends_at.slice(0, 5) };
        setAvailabilities(map);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [campaignId]);

  function selectDay(date: string) {
    setSelectedDate(date);
    const existing = availabilities[date];
    setDraftStart(existing?.startsAt ?? DEFAULT_START);
    setDraftEnd(existing?.endsAt ?? DEFAULT_END);
  }

  function save() {
    if (!selectedDate) return;
    if (draftEnd <= draftStart) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    fetch(`/api/campaigns/${campaignId}/scheduling/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, startsAt: draftStart, endsAt: draftEnd }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(() => {
        setAvailabilities((prev) => ({ ...prev, [selectedDate]: { startsAt: draftStart, endsAt: draftEnd } }));
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }

  function clear() {
    if (!selectedDate) return;
    setStatus("saving");
    fetch(`/api/campaigns/${campaignId}/scheduling/availability/${selectedDate}`, { method: "DELETE" })
      .then((res) => (res.ok || res.status === 204 ? undefined : Promise.reject(new Error())))
      .then(() => {
        setAvailabilities((prev) => {
          const next = { ...prev };
          delete next[selectedDate];
          return next;
        });
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }

  const firstOfMonth = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // lundi = 0

  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthsWithData = useMemo(() => {
    const set = new Set<string>();
    for (const date of Object.keys(availabilities)) set.add(date.slice(0, 7));
    return set;
  }, [availabilities]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setView((v) => addMonths(v.year, v.month, -1))} className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-panel-raised" aria-label="Mois précédent">
          ‹
        </button>
        <span className="text-sm font-medium text-ink">
          {MONTH_LABELS[view.month]} {view.year}
        </span>
        <button type="button" onClick={() => setView((v) => addMonths(v.year, v.month, 1))} className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-panel-raised" aria-label="Mois suivant">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-mono text-ink-muted">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const date = toDateKey(view.year, view.month, day);
          const entry = availabilities[date];
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              onClick={() => selectDay(date)}
              className={`flex flex-col items-center rounded py-1 text-xs transition-colors ${
                isSelected ? "outline outline-2 outline-accent" : ""
              } ${entry ? "bg-accent/15 text-accent" : "text-ink hover:bg-panel-raised"}`}
            >
              <span>{day}</span>
              {entry && <span className="font-mono text-[8px] leading-none">{entry.startsAt}</span>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="flex flex-col gap-2 rounded-md border border-edge bg-panel-sunken p-2.5">
          <span className="text-xs font-medium text-ink">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>Libre de</span>
            <input type="time" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} className="rounded border border-edge bg-transparent px-1.5 py-0.5 text-ink" />
            <span>à</span>
            <input type="time" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} className="rounded border border-edge bg-transparent px-1.5 py-0.5 text-ink" />
          </div>
          {status === "error" && <span className="text-xs text-danger">L&apos;heure de fin doit être après le début.</span>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={status === "saving"} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50">
              Enregistrer
            </button>
            {availabilities[selectedDate] && (
              <button type="button" onClick={clear} className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted hover:text-danger">
                Effacer
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-t border-edge/60 pt-2">
        {Array.from({ length: 12 }, (_, i) => addMonths(today.getFullYear(), today.getMonth(), i)).map(({ year, month }) => {
          const key = `${year}-${pad(month + 1)}`;
          const filled = monthsWithData.has(key);
          const isCurrentView = year === view.year && month === view.month;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView({ year, month })}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                isCurrentView ? "bg-accent text-accent-ink" : filled ? "bg-accent/15 text-accent" : "bg-panel-sunken text-ink-faint"
              }`}
            >
              {MONTH_SHORT[month]}
            </button>
          );
        })}
      </div>
      {!loaded && <span className="text-xs text-ink-muted">Chargement…</span>}
    </div>
  );
}
