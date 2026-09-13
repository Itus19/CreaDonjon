"use client";

import { useEffect, useState } from "react";
import { minutesToTime, type SessionCategory } from "@/src/core/scheduling/overlap";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface RosterEntry {
  userId: string;
  name: string | null;
  startsAt: string;
  endsAt: string;
}
interface RankedDay {
  date: string;
  participantCount: number;
  totalMembers: number;
  overlap: { start: number; end: number; durationMinutes: number };
  category: SessionCategory;
  roster: RosterEntry[];
}
interface RealSession {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
  source: string;
}

const CATEGORY_STYLE: Record<SessionCategory, string> = {
  full: "bg-success/10 text-success",
  short: "bg-accent/10 text-accent",
  none: "text-ink-muted",
};
const CATEGORY_LABEL: Record<SessionCategory, string> = { full: "session complète", short: "session raccourcie", none: "aucun créneau commun" };

function addMonths(year: number, month: number, delta: number) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default function SchedulingMjPanel({ campaignId }: { campaignId: string }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [days, setDays] = useState<RankedDay[]>([]);
  const [targetMinutes, setTargetMinutes] = useState(300);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<RealSession[]>([]);
  const [past, setPast] = useState<RealSession[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("19:00");
  const [manualDuration, setManualDuration] = useState(300);
  const [durationDraft, setDurationDraft] = useState(300);

  function loadRecap() {
    fetch(`/api/campaigns/${campaignId}/scheduling/recap?year=${view.year}&month=${view.month}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { days: RankedDay[]; targetMinutes: number }) => {
        setDays(body.days);
        setTargetMinutes(body.targetMinutes);
        setDurationDraft(body.targetMinutes);
      })
      .catch(() => {});
  }

  function loadSessions() {
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { upcoming: RealSession[]; past: RealSession[] }) => {
        setUpcoming(body.upcoming);
        setPast(body.past);
      })
      .catch(() => {});
  }

  useEffect(loadRecap, [campaignId, view.year, view.month]);
  useEffect(loadSessions, [campaignId]);

  function confirmDay(day: RankedDay) {
    const duration = Math.min(day.overlap.durationMinutes, targetMinutes) || day.overlap.durationMinutes;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: day.date, startsAt: minutesToTime(day.overlap.start), durationMinutes: duration, source: "availability" }),
    }).then(() => loadSessions());
  }

  function confirmManual() {
    if (!manualDate) return;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: manualDate, startsAt: manualTime, durationMinutes: manualDuration, source: "manual" }),
    }).then(() => {
      setManualDate("");
      loadSessions();
    });
  }

  function cancelSession(id: string) {
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions/${id}`, { method: "DELETE" }).then(() => loadSessions());
  }

  function saveDuration() {
    fetch(`/api/campaigns/${campaignId}/scheduling/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: durationDraft }),
    }).then(() => loadRecap());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">Durée de session visée :</span>
        <input
          type="number"
          min={30}
          step={30}
          value={durationDraft}
          onChange={(e) => setDurationDraft(Number(e.target.value))}
          className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        />
        <span className="text-xs text-ink-muted">minutes</span>
        {durationDraft !== targetMinutes && (
          <button type="button" onClick={saveDuration} className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink hover:bg-panel-raised">
            Enregistrer
          </button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setView((v) => addMonths(v.year, v.month - 1, -1))} className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-panel-raised">
            ‹
          </button>
          <span className="text-sm font-medium text-ink">
            {MONTH_LABELS[view.month - 1]} {view.year}
          </span>
          <button type="button" onClick={() => setView((v) => addMonths(v.year, v.month - 1, 1))} className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-panel-raised">
            ›
          </button>
        </div>

        {days.length === 0 ? (
          <p className="text-xs italic text-ink-muted">Aucune disponibilité renseignée ce mois-ci.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {days.map((day) => (
              <div key={day.date} className={`rounded-md border border-edge/60 p-2 text-xs ${CATEGORY_STYLE[day.category]}`}>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setExpanded((e) => (e === day.date ? null : day.date))} className="flex-1 text-left font-medium text-ink">
                    {formatDateLabel(day.date)} — {day.participantCount}/{day.totalMembers}
                    {day.category !== "none" && (
                      <span className="ml-1.5 font-mono text-[10px]">
                        {minutesToTime(day.overlap.start)}–{minutesToTime(day.overlap.end)} ({Math.round(day.overlap.durationMinutes / 60)}h)
                      </span>
                    )}
                  </button>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide">{CATEGORY_LABEL[day.category]}</span>
                  {day.category !== "none" && (
                    <button type="button" onClick={() => confirmDay(day)} className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-accent-ink hover:bg-accent-hover">
                      Confirmer
                    </button>
                  )}
                </div>
                {expanded === day.date && (
                  <div className="mt-1.5 flex flex-col gap-0.5 border-t border-edge/40 pt-1.5 font-mono text-[10px] text-ink-muted">
                    {day.roster.map((r) => (
                      <span key={r.userId}>
                        {r.name ?? "?"} — {r.startsAt.slice(0, 5)}–{r.endsAt.slice(0, 5)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Régler manuellement</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
          <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
          <input
            type="number"
            min={30}
            step={30}
            value={manualDuration}
            onChange={(e) => setManualDuration(Number(e.target.value))}
            className="w-20 rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none"
          />
          <span className="text-ink-muted">min</span>
          <button type="button" onClick={confirmManual} disabled={!manualDate} className="rounded-full bg-accent px-3 py-1 font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50">
            Confirmer cette date
          </button>
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Séances à venir</span>
        <div className="mt-1.5 flex flex-col gap-1">
          {upcoming.length === 0 && <p className="text-xs italic text-ink-muted">Aucune séance confirmée.</p>}
          {upcoming.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded bg-panel-sunken px-2 py-1 font-mono text-[10px] text-ink-muted">
              <span>
                {formatDateLabel(s.scheduled_date)} {s.starts_at.slice(0, 5)} ({Math.round(s.duration_minutes / 60)}h) — {s.source === "manual" ? "manuel" : "disponibilités"}
              </span>
              <button type="button" onClick={() => cancelSession(s.id)} className="text-danger hover:underline">
                Annuler
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Historique des parties jouées</span>
        <div className="mt-1.5 flex flex-col gap-1">
          {past.length === 0 && <p className="text-xs italic text-ink-muted">Aucune séance passée.</p>}
          {past.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded bg-panel-sunken px-2 py-1 font-mono text-[10px] text-ink-muted">
              <span>
                {formatDateLabel(s.scheduled_date)} {s.starts_at.slice(0, 5)} ({Math.round(s.duration_minutes / 60)}h)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
