"use client";

import { useMemo, useRef, useState } from "react";
import Tabs from "@/components/shared/Tabs";
import TimeRangeSlider from "./TimeRangeSlider";
import { expandWeekdayPattern } from "@/src/core/scheduling/candidateDates";
import { minutesToTime, timeToMinutes } from "@/src/core/scheduling/overlap";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

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

/**
 * Sélecteur de dates candidates au clic ou au clic-glissé (V3.1-8, retour
 * utilisateur : "clique ou clique-glissé doivent être possibles") — glisser
 * peint une plage de jours d'un coup, dans le même sens (ajout ou retrait)
 * que le jour où le glissé a commencé.
 */
function CandidateDateCalendar({ selected, onToggle }: { selected: Set<string>; onToggle: (dates: string[], add: boolean) => void }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const dragModeRef = useRef<"add" | "remove" | null>(null);

  const firstOfMonth = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function startDrag(date: string) {
    const add = !selected.has(date);
    dragModeRef.current = add ? "add" : "remove";
    onToggle([date], add);
  }
  function continueDrag(date: string) {
    if (dragModeRef.current === null) return;
    onToggle([date], dragModeRef.current === "add");
  }
  function endDrag() {
    dragModeRef.current = null;
  }

  return (
    <div className="flex flex-col gap-2" onMouseUp={endDrag} onMouseLeave={endDrag}>
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
      <div className="grid select-none grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-mono text-ink-muted">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const date = toDateKey(view.year, view.month, day);
          const isSelected = selected.has(date);
          return (
            <button
              key={date}
              type="button"
              onMouseDown={() => startDrag(date)}
              onMouseEnter={() => continueDrag(date)}
              className={`rounded py-1.5 text-xs transition-colors ${isSelected ? "bg-accent text-accent-ink" : "text-ink hover:bg-panel-raised"}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekdayPatternPicker({ onApply }: { onApply: (dates: string[]) => void }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const preview = useMemo(() => {
    if (weekdays.size === 0 || !from || !to || to < from) return [];
    return expandWeekdayPattern([...weekdays], from, to);
  }, [weekdays, from, to]);

  function toggleWeekday(i: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleWeekday(i)}
            className={`h-8 w-8 rounded-full text-xs transition-colors ${weekdays.has(i) ? "bg-accent text-accent-ink" : "border border-edge text-ink hover:bg-panel-raised"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span>Du</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
        <span>au</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted">{preview.length} date{preview.length !== 1 ? "s" : ""} candidate{preview.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          disabled={preview.length === 0}
          onClick={() => onApply(preview)}
          className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}

/**
 * Formulaire « Demander prochaines disponibilités » (V3.1-8) — en ligne
 * dans le Calendrier réel, jamais dans une fenêtre pop-up (retour
 * utilisateur : "j'aimerais que tout se passe dans la fenêtre de calendrier
 * réel") : une seule page qui empile nom → dates candidates → plage
 * horaire, à l'image de crab.fit (retour utilisateur : "quasi copié-collé
 * de ce que propose crab.fit"), avec la DA de CreaDonjon.
 */
export default function RequestAvailabilityForm({ campaignId, onCreated }: { campaignId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [dateTab, setDateTab] = useState("specific");
  const [range, setRange] = useState({ startMinutes: timeToMinutes("19:00"), endMinutes: timeToMinutes("23:00") });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleDates(dates: string[], add: boolean) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      for (const date of dates) {
        if (add) next.add(date);
        else next.delete(date);
      }
      return next;
    });
  }

  async function create() {
    if (selectedDates.size === 0) {
      setError("Choisis au moins une date candidate.");
      return;
    }
    setError(null);
    setPending(true);
    const res = await fetch(`/api/campaigns/${campaignId}/scheduling/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        candidateDates: [...selectedDates],
        startsAt: minutesToTime(range.startMinutes),
        endsAt: minutesToTime(range.endMinutes),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la création.");
      return;
    }
    onCreated();
  }

  return (
    <div className="flex flex-col gap-5 rounded-md border border-edge/60 p-4">
      <div>
        <span className="text-sm font-semibold text-ink">Demander prochaines disponibilités</span>
        <p className="text-xs text-ink-muted">Donnez un nom à votre événement, ou laissez vide pour en générer un.</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Laisser vide pour en générer un"
          maxLength={120}
          className="mt-2 w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </div>

      <div>
        <span className="text-sm font-semibold text-ink">Quelles dates pourraient fonctionner ?</span>
        <p className="text-xs text-ink-muted">Cliquez ou cliquez-glissez pour sélectionner.</p>
        <div className="mt-2">
          <Tabs
            value={dateTab}
            onChange={setDateTab}
            items={[
              { value: "specific", label: "Dates précises" },
              { value: "weekday", label: "Jours de la semaine" },
            ]}
          />
        </div>
        <div className="mt-2">
          {dateTab === "specific" ? (
            <CandidateDateCalendar selected={selectedDates} onToggle={toggleDates} />
          ) : (
            <WeekdayPatternPicker onApply={(dates) => setSelectedDates(new Set(dates))} />
          )}
        </div>
        <span className="mt-1 block text-xs text-ink-muted">
          {selectedDates.size} date{selectedDates.size !== 1 ? "s" : ""} sélectionnée{selectedDates.size !== 1 ? "s" : ""}
        </span>
      </div>

      <div>
        <span className="text-sm font-semibold text-ink">Quels créneaux horaires pourraient convenir ?</span>
        <TimeRangeSlider startMinutes={range.startMinutes} endMinutes={range.endMinutes} onChange={setRange} />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={create}
        className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Création…" : "Créer"}
      </button>
    </div>
  );
}
