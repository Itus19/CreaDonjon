"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { generateSlots, rangeFromSlots } from "@/src/core/scheduling/availabilityGrid";
import { minutesToTime, timeToMinutes } from "@/src/core/scheduling/overlap";

const STEP_MINUTES = 30;

interface AvailabilityRequest {
  id: string;
  title: string;
  candidate_dates: string[];
  starts_at: string;
  ends_at: string;
}
interface MyResponse {
  date: string;
  starts_at: string;
  ends_at: string;
}

function formatDateHeader(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function slotsFromRange(startMinutes: number, endMinutes: number, allSlots: readonly number[]): Set<number> {
  return new Set(allSlots.filter((s) => s >= startMinutes && s + STEP_MINUTES <= endMinutes));
}

/**
 * Réponse à une ronde de demande, au clic ou au clic-glissé sur une grille
 * (V3.1-8, retour utilisateur : "sélectionner les plages horaires par
 * jours" comme sur crab.fit) — remplace les deux champs heure par colonne.
 * Peindre des cases comble les trous en une seule plage continue par jour
 * (`rangeFromSlots`, même choix que V2.1-4 : jamais deux disponibilités
 * disjointes le même soir) — la grille est une façon de saisir cette même
 * plage, pas un nouveau modèle de données.
 */
export default function AvailabilityPaintGrid({
  campaignId,
  request,
  myResponses,
  onSaved,
  hideTitle,
}: {
  campaignId: string;
  request: AvailabilityRequest;
  myResponses: MyResponse[];
  onSaved: () => void;
  /** Le titre de la ronde est déjà affiché par l'écran appelant (`SchedulingMjPanel.tsx`) — jamais répété. */
  hideTitle?: boolean;
}) {
  const dates = useMemo(() => [...request.candidate_dates].sort(), [request.candidate_dates]);
  const slots = useMemo(() => generateSlots(timeToMinutes(request.starts_at), timeToMinutes(request.ends_at), STEP_MINUTES), [request.starts_at, request.ends_at]);

  const [painted, setPainted] = useState<Record<string, Set<number>>>(() => {
    const initial: Record<string, Set<number>> = {};
    for (const r of myResponses) initial[r.date] = slotsFromRange(timeToMinutes(r.starts_at), timeToMinutes(r.ends_at), slots);
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState<Set<string>>(new Set());

  const dragModeRef = useRef<"add" | "remove" | null>(null);
  const touchedDatesRef = useRef<Set<string>>(new Set());

  function paintCell(date: string, slotStart: number, add: boolean) {
    setPainted((prev) => {
      const next = { ...prev };
      const set = new Set(next[date] ?? []);
      if (add) set.add(slotStart);
      else set.delete(slotStart);
      next[date] = set;
      return next;
    });
    touchedDatesRef.current.add(date);
  }

  function startDrag(date: string, slotStart: number) {
    const add = !(painted[date]?.has(slotStart) ?? false);
    dragModeRef.current = add ? "add" : "remove";
    paintCell(date, slotStart, add);
  }
  function continueDrag(date: string, slotStart: number) {
    if (dragModeRef.current === null) return;
    paintCell(date, slotStart, dragModeRef.current === "add");
  }

  async function saveTouchedDates() {
    const touched = [...touchedDatesRef.current];
    touchedDatesRef.current.clear();
    if (touched.length === 0) return;
    setSavingDates((prev) => new Set([...prev, ...touched]));
    setError(null);
    await Promise.all(
      touched.map(async (date) => {
        const range = rangeFromSlots([...(painted[date] ?? [])], STEP_MINUTES);
        const res = range
          ? await fetch(`/api/campaigns/${campaignId}/scheduling/availability`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, startsAt: minutesToTime(range.startMinutes), endsAt: minutesToTime(range.endMinutes) }),
            })
          : await fetch(`/api/campaigns/${campaignId}/scheduling/availability/${date}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "Échec de l'enregistrement.");
        }
      })
    );
    setSavingDates((prev) => {
      const next = new Set(prev);
      for (const date of touched) next.delete(date);
      return next;
    });
    onSaved();
  }

  function endDrag() {
    dragModeRef.current = null;
    void saveTouchedDates();
  }

  return (
    <div className="flex flex-col gap-2" onMouseUp={endDrag} onMouseLeave={endDrag}>
      {!hideTitle && <p className="text-xs text-ink-muted">{request.title} — cliquez ou cliquez-glissez pour indiquer vos disponibilités.</p>}
      <div className="overflow-x-auto">
        <div className="inline-grid select-none gap-px" style={{ gridTemplateColumns: `48px repeat(${dates.length}, 36px)` }}>
          <div />
          {dates.map((date) => (
            <div key={date} className="pb-1 text-center font-mono text-[10px] text-ink-muted">
              {formatDateHeader(date)}
              {savingDates.has(date) && <span className="ml-0.5 text-accent">…</span>}
            </div>
          ))}
          {slots.map((slotStart) => (
            <Fragment key={slotStart}>
              <div className="pr-1 text-right font-mono text-[10px] leading-[20px] text-ink-muted">{slotStart % 60 === 0 ? minutesToTime(slotStart) : ""}</div>
              {dates.map((date) => {
                const isPainted = painted[date]?.has(slotStart) ?? false;
                return (
                  <button
                    key={`${date}|${slotStart}`}
                    type="button"
                    onMouseDown={() => startDrag(date, slotStart)}
                    onMouseEnter={() => continueDrag(date, slotStart)}
                    aria-label={`${formatDateHeader(date)} ${minutesToTime(slotStart)}`}
                    className={`h-5 w-full border border-panel-sunken transition-colors ${isPainted ? "bg-accent" : "bg-panel-sunken hover:bg-panel-raised"}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
