"use client";

import { useEffect, useState } from "react";
import { minutesToTime, timeToMinutes, type SessionCategory } from "@/src/core/scheduling/overlap";
import RequestAvailabilityForm from "./RequestAvailabilityForm";
import AvailabilityHeatmap from "./AvailabilityHeatmap";
import AvailabilityPaintGrid from "./AvailabilityPaintGrid";

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
interface AvailabilityRequest {
  id: string;
  title: string;
  candidate_dates: string[];
  starts_at: string;
  ends_at: string;
}
interface HeatmapCell {
  date: string;
  slotStart: number;
  users: { userId: string; name: string | null }[];
}
interface Heatmap {
  slots: number[];
  step: number;
  cells: HeatmapCell[];
}
interface RealSession {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
  source: string;
}
interface MyResponse {
  date: string;
  starts_at: string;
  ends_at: string;
}

const CATEGORY_STYLE: Record<SessionCategory, string> = {
  full: "bg-success/10 text-success",
  short: "bg-accent/10 text-accent",
  none: "text-ink-muted",
};
const CATEGORY_LABEL: Record<SessionCategory, string> = { full: "session complète", short: "session raccourcie", none: "aucun créneau commun" };

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Calendrier réel côté MJ (V2.1-4, refondu V3.1-8) : le classement libre par
 * mois a disparu, remplacé par la vue de la ronde de demande ouverte — le MJ
 * propose des dates candidates précises plutôt que de parcourir un
 * calendrier sans fin cherchant ce qui a été rempli. Le formulaire de
 * demande (`RequestAvailabilityForm.tsx`) s'affiche en ligne, jamais dans
 * une fenêtre pop-up (retour utilisateur), directement à la place du
 * classement tant qu'aucune ronde n'est ouverte. Le réglage manuel et
 * l'historique restent inchangés (retour utilisateur d'origine : "le MJ
 * doit pouvoir mettre manuellement la prochaine date sans passer par
 * l'outil").
 */
export default function SchedulingMjPanel({ campaignId }: { campaignId: string }) {
  const [openRequest, setOpenRequest] = useState<AvailabilityRequest | null | "loading">("loading");
  const [days, setDays] = useState<RankedDay[]>([]);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  // `null` tant que non chargé — `AvailabilityPaintGrid` initialise son état
  // peint UNE SEULE fois au montage : le rendre avant que la vraie réponse
  // du MJ soit connue figerait la grille sur "rien peint" pour de bon.
  const [myAvailabilities, setMyAvailabilities] = useState<MyResponse[] | null>(null);
  const [targetMinutes, setTargetMinutes] = useState(300);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<RealSession[]>([]);
  const [past, setPast] = useState<RealSession[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("19:00");
  const [manualEndTime, setManualEndTime] = useState("23:00");
  const [durationDraft, setDurationDraft] = useState(300);

  const manualDuration = timeToMinutes(manualEndTime) - timeToMinutes(manualTime);

  function loadOpenRequest() {
    fetch(`/api/campaigns/${campaignId}/scheduling/requests/open`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { request: AvailabilityRequest | null; days: RankedDay[]; heatmap: Heatmap | null; targetMinutes: number }) => {
        setOpenRequest(body.request);
        setDays(body.days);
        setHeatmap(body.heatmap);
        setTargetMinutes(body.targetMinutes);
        setDurationDraft(body.targetMinutes);
      })
      .catch(() => setOpenRequest(null));
    // Le MJ répond aussi désormais (retour utilisateur V3.1-8 : "le MJ doit
    // aussi pouvoir mettre ses dispos") — même endpoint que côté joueuse,
    // il renvoie toujours les réponses de l'appelant authentifié.
    fetch(`/api/campaigns/${campaignId}/scheduling/availability`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { availabilities: MyResponse[] }) => setMyAvailabilities(body.availabilities))
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

  useEffect(loadOpenRequest, [campaignId]);
  useEffect(loadSessions, [campaignId]);

  function confirmDay(day: RankedDay) {
    const duration = Math.min(day.overlap.durationMinutes, targetMinutes) || day.overlap.durationMinutes;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: day.date, startsAt: minutesToTime(day.overlap.start), durationMinutes: duration, source: "availability" }),
    }).then(() => {
      loadSessions();
      loadOpenRequest();
    });
  }

  function cancelRequest() {
    if (!openRequest || openRequest === "loading") return;
    fetch(`/api/campaigns/${campaignId}/scheduling/requests/${openRequest.id}/close`, { method: "POST" }).then(loadOpenRequest);
  }

  function confirmManual() {
    if (!manualDate || manualDuration <= 0) return;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: manualDate, startsAt: manualTime, durationMinutes: manualDuration, source: "manual" }),
    }).then(() => {
      setManualDate("");
      loadSessions();
      loadOpenRequest();
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
    }).then(() => loadOpenRequest());
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
        {openRequest === "loading" ? (
          <p className="text-xs italic text-ink-muted">Chargement…</p>
        ) : openRequest === null ? (
          <RequestAvailabilityForm campaignId={campaignId} onCreated={loadOpenRequest} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{openRequest.title}</span>
              <button type="button" onClick={cancelRequest} className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink-muted hover:text-danger">
                Annuler la demande
              </button>
            </div>
            <span className="text-xs font-mono text-ink-muted">
              {openRequest.starts_at.slice(0, 5)}–{openRequest.ends_at.slice(0, 5)} suggéré
            </span>
            <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 p-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Mes disponibilités</span>
              {myAvailabilities === null ? (
                <p className="text-xs italic text-ink-muted">Chargement…</p>
              ) : (
                <AvailabilityPaintGrid campaignId={campaignId} request={openRequest} myResponses={myAvailabilities} onSaved={loadOpenRequest} hideTitle />
              )}
            </div>
            {heatmap && (
              <AvailabilityHeatmap dates={openRequest.candidate_dates} slots={heatmap.slots} cells={heatmap.cells} totalMembers={days[0]?.totalMembers ?? 0} />
            )}
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
                      {day.roster.length === 0 && <span>Personne n&apos;a encore répondu.</span>}
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
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Régler manuellement</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
          <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
          <span className="text-ink-muted">à</span>
          <input type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} className="rounded border border-edge bg-transparent px-2 py-1 text-ink outline-none" />
          <span className="text-ink-muted">
            {manualDuration > 0 ? `(${Math.round((manualDuration / 60) * 10) / 10}h)` : "(heure de fin avant le début)"}
          </span>
          <button type="button" onClick={confirmManual} disabled={!manualDate || manualDuration <= 0} className="rounded-full bg-accent px-3 py-1 font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50">
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
