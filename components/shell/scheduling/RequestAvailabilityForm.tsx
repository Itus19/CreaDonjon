"use client";

import { useMemo, useRef, useState } from "react";
import TimeRangeSlider from "./TimeRangeSlider";
import AvailabilityGrid from "./AvailabilityGrid";
import { expandWeekdayPattern } from "@/src/core/scheduling/candidateDates";
import { generateSlots } from "@/src/core/scheduling/availabilityGrid";
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
function todayKey(): string {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Un mois du sélecteur de dates — les jours passés restent visibles mais ne se choisissent plus. */
function MonthGrid({
  year,
  month,
  selected,
  today,
  onStart,
  onContinue,
}: {
  year: number;
  month: number;
  selected: Set<string>;
  today: string;
  onStart: (date: string) => void;
  onContinue: (date: string) => void;
}) {
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-center text-sm font-semibold text-ink">
        {MONTH_LABELS[month]} {year}
      </div>
      <div className="grid select-none grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="text-center font-mono text-xs text-ink-muted">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const date = toDateKey(year, month, day);
          const isSelected = selected.has(date);
          const past = date < today;
          return (
            <button
              key={date}
              type="button"
              disabled={past}
              aria-pressed={isSelected}
              onMouseDown={() => onStart(date)}
              onMouseEnter={() => onContinue(date)}
              className={`h-9 rounded-lg text-sm transition-colors ${isSelected ? "bg-accent font-semibold text-accent-ink" : past ? "cursor-default text-ink-muted/60" : "text-ink hover:bg-panel-raised"}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Sélecteur de dates candidates au clic ou au clic-glissé (V3.1-8) — glisser
 * peint une plage de jours d'un coup, dans le même sens (ajout ou retrait)
 * que le jour où le glissé a commencé. Deux mois côte à côte depuis V3.1-16
 * (esquisse « Formulaire ») : une demande à cheval sur la fin d'un mois se
 * compose sans tourner la page.
 */
function CandidateDateCalendar({ selected, onToggle }: { selected: Set<string>; onToggle: (dates: string[], add: boolean) => void }) {
  const today = useMemo(() => todayKey(), []);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const next = addMonths(view.year, view.month, 1);
  const dragModeRef = useRef<"add" | "remove" | null>(null);

  function startDrag(date: string) {
    const add = !selected.has(date);
    dragModeRef.current = add ? "add" : "remove";
    onToggle([date], add);
  }
  function continueDrag(date: string) {
    if (dragModeRef.current === null || date < today) return;
    onToggle([date], dragModeRef.current === "add");
  }
  function endDrag() {
    dragModeRef.current = null;
  }

  return (
    <div className="flex items-start gap-2" onMouseUp={endDrag} onMouseLeave={endDrag}>
      <button
        type="button"
        onClick={() => setView((v) => addMonths(v.year, v.month, -1))}
        className="mt-0.5 rounded-full px-2.5 py-1 text-sm text-ink-muted hover:bg-panel-raised"
        aria-label="Mois précédent"
      >
        ‹
      </button>
      <div className="grid flex-1 grid-cols-1 gap-7 md:grid-cols-2">
        <MonthGrid year={view.year} month={view.month} selected={selected} today={today} onStart={startDrag} onContinue={continueDrag} />
        <MonthGrid year={next.year} month={next.month} selected={selected} today={today} onStart={startDrag} onContinue={continueDrag} />
      </div>
      <button
        type="button"
        onClick={() => setView((v) => addMonths(v.year, v.month, 1))}
        className="mt-0.5 rounded-full px-2.5 py-1 text-sm text-ink-muted hover:bg-panel-raised"
        aria-label="Mois suivant"
      >
        ›
      </button>
    </div>
  );
}

function WeekdayPatternPicker({ onApply }: { onApply: (dates: string[]) => void }) {
  const today = useMemo(() => todayKey(), []);
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

  const inputClass = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {WEEKDAY_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={weekdays.has(i)}
            onClick={() => toggleWeekday(i)}
            className={`h-9 w-9 rounded-full text-sm transition-colors ${weekdays.has(i) ? "bg-accent font-semibold text-accent-ink" : "border border-edge text-ink hover:bg-panel-raised"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>Du</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Premier jour" className={inputClass} />
        <span>au</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Dernier jour" className={inputClass} />
        <span className="ml-1 text-xs">
          {preview.length} date{preview.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          disabled={preview.length === 0}
          onClick={() => onApply(preview)}
          className="rounded-full border border-edge px-3 py-1 text-sm text-ink hover:bg-panel-raised disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, hint, children, aside }: { n: number; title: string; hint: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-ink">{title}</div>
            <div className="text-xs text-ink-muted">{hint}</div>
          </div>
          {aside}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Formulaire « Demander les disponibilités » (V3.1-8, redessiné V3.1-16
 * d'après l'esquisse « MJ — formuler une demande ») — en ligne dans le
 * Calendrier réel, jamais dans une fenêtre pop-up. Trois étapes numérotées
 * (nom, dates, plage horaire), puis **l'aperçu en direct de la grille que
 * verront les joueuses** (`AvailabilityGrid` en mode `preview`) : chaque
 * date ajoutée devient une colonne, chaque demi-heure une ligne.
 */
export default function RequestAvailabilityForm({ campaignId, onCreated, onCancel }: { campaignId: string; onCreated: () => void; onCancel?: () => void }) {
  const [title, setTitle] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [dateTab, setDateTab] = useState<"specific" | "weekday">("specific");
  const [range, setRange] = useState({ startMinutes: timeToMinutes("19:00"), endMinutes: timeToMinutes("23:00") });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sortedDates = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const slotCount = generateSlots(range.startMinutes, range.endMinutes, 30).length;

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
        candidateDates: sortedDates,
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

  const previewRequest = {
    id: "apercu",
    title: title.trim() || "Aperçu",
    candidate_dates: sortedDates,
    starts_at: minutesToTime(range.startMinutes),
    ends_at: minutesToTime(range.endMinutes),
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-5 rounded-[14px] border border-edge bg-panel p-5">
        <Step n={1} title="Nom de la demande" hint="Laisse vide pour en générer un (« Séance du … »).">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session de fin octobre"
            maxLength={120}
            aria-label="Nom de la demande"
            className="w-full max-w-md rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </Step>
        <div className="h-px bg-edge/50" />
        <Step
          n={2}
          title="Quelles dates ?"
          hint="Clique ou glisse pour ajouter ou retirer des jours. Seules ces dates deviendront des colonnes."
          aside={
            <div role="tablist" aria-label="Façon de choisir les dates" className="inline-flex gap-0.5 rounded-full border border-edge bg-panel-sunken p-[3px]">
              {(
                [
                  ["specific", "Dates précises"],
                  ["weekday", "Jours de la semaine"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={dateTab === value}
                  onClick={() => setDateTab(value)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${dateTab === value ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-panel-raised"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {dateTab === "specific" ? (
            <CandidateDateCalendar selected={selectedDates} onToggle={toggleDates} />
          ) : (
            <WeekdayPatternPicker onApply={(dates) => setSelectedDates(new Set(dates))} />
          )}
        </Step>
        <div className="h-px bg-edge/50" />
        <Step n={3} title="Quelle plage horaire ?" hint="Elle devient les lignes de la grille, par demi-heure. De 00:00 à 24:00, jamais à cheval sur minuit.">
          <TimeRangeSlider startMinutes={range.startMinutes} endMinutes={range.endMinutes} onChange={setRange} />
        </Step>
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-edge bg-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg text-ink">Aperçu : la grille que verront les joueuses</h3>
          <span className="font-mono text-xs text-ink-muted">
            {sortedDates.length} date{sortedDates.length !== 1 ? "s" : ""} · {minutesToTime(range.startMinutes)} – {minutesToTime(range.endMinutes)} · {slotCount} demi-heures par jour
          </span>
        </div>
        {sortedDates.length > 0 ? (
          <AvailabilityGrid
            campaignId={campaignId}
            request={previewRequest}
            myResponses={[]}
            heatmap={null}
            expected={0}
            viewerId={null}
            onSaved={() => {}}
            preview
          />
        ) : (
          <div className="rounded-[10px] border border-dashed border-edge p-7 text-center text-sm text-ink-muted">Choisis au moins une date pour voir la grille.</div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2.5">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-full border border-edge px-4 py-1.5 text-sm text-ink hover:bg-panel-raised">
              Annuler
            </button>
          )}
          <button
            type="button"
            disabled={pending || sortedDates.length === 0}
            onClick={create}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Envoi…" : "Envoyer la demande"}
          </button>
        </div>
      </section>
    </div>
  );
}
