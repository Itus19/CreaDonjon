"use client";

import { useEffect, useRef, useState } from "react";
import { minutesToTime, timeToMinutes } from "@/src/core/scheduling/overlap";
import RequestAvailabilityForm from "./RequestAvailabilityForm";
import AvailabilityGrid, { type GridResponse } from "./AvailabilityGrid";
import { NextSessionCard, PossibleDates, SessionsCard, formatHours, respondentCount, type OpenRequestBoard, type RankedDay, type RealSession } from "./SessionBoardParts";

/**
 * Calendrier réel côté MJ (V2.1-4, refondu V3.1-8, redessiné V3.1-16 d'après
 * l'esquisse « A — Retenue », `Main.dc.html`) : en-tête de la demande, UNE
 * grille à bascule « Mes disponibilités / Toute la table »
 * (`AvailabilityGrid.tsx`), les dates possibles avec « Confirmer », puis
 * trois cartes : date à la main, séances à venir, déjà jouées. Sans ronde
 * ouverte : la prochaine séance confirmée et un écran vide avec « Demander
 * les disponibilités », qui ouvre le formulaire (`RequestAvailabilityForm.tsx`,
 * avec l'aperçu en direct de la grille) à la place de la grille. Tous les
 * gestes d'avant restent : durée visée, annuler la demande, confirmer, régler
 * à la main, annuler une séance.
 */
const DURATION_MIN = 60;
const DURATION_MAX = 840;
const DURATION_STEP = 30;

export default function SchedulingMjPanel({ campaignId }: { campaignId: string }) {
  const [board, setBoard] = useState<OpenRequestBoard | "loading" | "error">("loading");
  // `null` tant que non chargé — la grille initialise son état peint UNE
  // SEULE fois au montage : la rendre avant que la vraie réponse du MJ soit
  // connue la figerait sur « rien peint ».
  const [myAvailabilities, setMyAvailabilities] = useState<GridResponse[] | null>(null);
  const [upcoming, setUpcoming] = useState<RealSession[]>([]);
  const [past, setPast] = useState<RealSession[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("19:00");
  const [manualEndTime, setManualEndTime] = useState("23:00");
  const [durationDraft, setDurationDraft] = useState(300);
  /** Sans demande en cours : l'écran vide (esquisse « MJ — sans demande »), puis le formulaire au clic. */
  const [showForm, setShowForm] = useState(false);

  /** Délai avant l'envoi de la durée : plusieurs clics sur − / + ne font qu'une requête. */
  const durationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const manualDuration = timeToMinutes(manualEndTime) - timeToMinutes(manualTime);

  function loadBoard() {
    fetch(`/api/campaigns/${campaignId}/scheduling/requests/open`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: OpenRequestBoard) => {
        setBoard(body);
        setDurationDraft(body.targetMinutes);
      })
      .catch(() => setBoard("error"));
  }

  function loadMyAvailabilities() {
    // Le MJ répond aussi (V3.1-8) — même endpoint que côté joueuse, il
    // renvoie toujours les réponses de l'appelant authentifié.
    fetch(`/api/campaigns/${campaignId}/scheduling/availability`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { availabilities: GridResponse[] }) => setMyAvailabilities(body.availabilities))
      .catch((erreur) => {
        console.error("Chargement de mes disponibilités impossible", erreur);
        setMyAvailabilities([]);
      });
  }

  function loadSessions() {
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { upcoming: RealSession[]; past: RealSession[] }) => {
        setUpcoming(body.upcoming);
        setPast(body.past);
      })
      .catch((erreur) => console.error("Chargement des séances réelles impossible", erreur));
  }

  useEffect(() => {
    loadBoard();
    loadMyAvailabilities();
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  function confirmDay(day: RankedDay) {
    if (board === "loading" || board === "error") return;
    const duration = Math.min(day.durationMinutes, board.targetMinutes) || day.durationMinutes;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: day.date, startsAt: minutesToTime(day.start), durationMinutes: duration, source: "availability" }),
    }).then(() => {
      loadSessions();
      loadBoard();
    });
  }

  function cancelRequest() {
    if (board === "loading" || board === "error" || !board.request) return;
    fetch(`/api/campaigns/${campaignId}/scheduling/requests/${board.request.id}/close`, { method: "POST" }).then(loadBoard);
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
      loadBoard();
    });
  }

  function cancelSession(id: string) {
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions/${id}`, { method: "DELETE" }).then(() => loadSessions());
  }

  function saveDuration(minutes: number) {
    fetch(`/api/campaigns/${campaignId}/scheduling/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    }).then(loadBoard);
  }

  /** − / + : pas de 30 min entre 1 h et 14 h, enregistré 500 ms après le dernier clic. */
  function stepDuration(delta: number) {
    const next = Math.min(DURATION_MAX, Math.max(DURATION_MIN, durationDraft + delta));
    if (next === durationDraft) return;
    setDurationDraft(next);
    if (durationTimer.current) clearTimeout(durationTimer.current);
    durationTimer.current = setTimeout(() => saveDuration(next), 500);
  }

  useEffect(
    () => () => {
      if (durationTimer.current) clearTimeout(durationTimer.current);
    },
    []
  );

  if (board === "loading") return <p className="text-xs italic text-ink-muted">Chargement…</p>;
  if (board === "error")
    return (
      <div className="flex items-center gap-3 text-sm text-danger">
        Impossible de charger le calendrier.
        <button type="button" onClick={loadBoard} className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised">
          Réessayer
        </button>
      </div>
    );

  const request = board.request;
  const inputClass = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">{request ? request.title : showForm ? "Demander les disponibilités" : "Prochaine séance"}</h2>
          {request && (
            <div className="mt-1 text-xs text-ink-muted">
              Créneau proposé · {request.starts_at.slice(0, 5)} – {request.ends_at.slice(0, 5)} · {request.candidate_dates.length} jours · {respondentCount(board.heatmap)} réponses sur {board.expected}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            Durée visée
            <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel-sunken p-[3px]">
              <button
                type="button"
                onClick={() => stepDuration(-DURATION_STEP)}
                disabled={durationDraft <= DURATION_MIN}
                aria-label="Diminuer la durée visée"
                className="grid h-6 w-6 place-items-center rounded-full text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                −
              </button>
              <b className="min-w-12 text-center font-mono text-sm font-medium text-ink">{formatHours(durationDraft)}</b>
              <button
                type="button"
                onClick={() => stepDuration(DURATION_STEP)}
                disabled={durationDraft >= DURATION_MAX}
                aria-label="Augmenter la durée visée"
                className="grid h-6 w-6 place-items-center rounded-full text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                +
              </button>
            </span>
          </div>
          {request && (
            <button type="button" onClick={cancelRequest} className="rounded-full border border-danger px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10">
              Annuler la demande
            </button>
          )}
        </div>
      </div>

      {request ? (
        <>
          <section className="flex flex-col gap-3 rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] p-4">
            {myAvailabilities === null ? (
              <p className="text-xs italic text-ink-muted">Chargement…</p>
            ) : (
              <AvailabilityGrid
                key={request.id}
                campaignId={campaignId}
                request={request}
                myResponses={myAvailabilities}
                heatmap={board.heatmap}
                expected={board.expected}
                viewerId={board.viewerId}
                onSaved={loadBoard}
              />
            )}
          </section>
          <PossibleDates
            title="Dates possibles"
            hint="seulement les jours où quelqu'un est disponible · classés par nombre de présents, puis par durée"
            days={board.days}
            targetMinutes={board.targetMinutes}
            onConfirm={confirmDay}
          />
        </>
      ) : showForm ? (
        <RequestAvailabilityForm
          campaignId={campaignId}
          onCreated={() => {
            setShowForm(false);
            loadBoard();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          <NextSessionCard session={upcoming[0] ?? null} />
          <section className="flex flex-col items-center gap-2.5 rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] px-6 py-9 text-center">
            <h3 className="font-display text-xl text-ink">Aucune demande de disponibilités en cours</h3>
            <p className="max-w-lg text-sm text-ink-muted">Propose des dates et une plage horaire : chaque joueuse coche ce qui lui va, et les meilleures dates se classent toutes seules.</p>
            <button type="button" onClick={() => setShowForm(true)} className="mt-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
              Demander les disponibilités
            </button>
          </section>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
        <section className="flex flex-col gap-2.5 rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)] p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Régler une date à la main</span>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} aria-label="Date de la séance" className={inputClass} />
            <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} aria-label="Début" className={inputClass} />
            <span className="text-ink-muted">à</span>
            <input type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} aria-label="Fin" className={inputClass} />
          </div>
          <button
            type="button"
            onClick={confirmManual}
            disabled={!manualDate || manualDuration <= 0}
            className="self-start rounded-full border border-edge px-3 py-1.5 text-sm text-ink hover:bg-panel-raised disabled:opacity-50"
          >
            {manualDuration > 0 ? `Confirmer cette date · ${formatHours(manualDuration)}` : "Heure de fin avant le début"}
          </button>
        </section>
        <SessionsCard title="Séances à venir" sessions={upcoming} emptyLabel="Aucune séance confirmée." onCancel={cancelSession} />
        <SessionsCard title="Déjà jouées" sessions={past} emptyLabel="Aucune séance passée." muted />
      </div>
    </div>
  );
}
