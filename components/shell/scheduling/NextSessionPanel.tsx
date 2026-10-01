"use client";

import { useCallback, useEffect, useState } from "react";
import AvailabilityGrid, { type GridResponse } from "./AvailabilityGrid";
import { PossibleDates, SessionsCard, formatDayLong, formatHours, type OpenRequestBoard, type RealSession } from "./SessionBoardParts";

interface OpenRequestResponse {
  campaignId: string | null;
  request: OpenRequestBoard["request"];
  hasResponded: boolean;
  myResponses: GridResponse[];
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function untilLabel(date: string): string {
  const n = daysUntil(date);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

function formatDayMonth(date: string): { day: string; month: string } {
  const d = new Date(`${date}T00:00:00`);
  return { day: String(d.getDate()), month: d.toLocaleDateString("fr-FR", { month: "short" }) };
}

/**
 * Page « Prochaine session » côté joueuse (V3.1-9, redessinée V3.1-16 d'après
 * l'esquisse « Vue joueuse », `Joueuse.dc.html`) : le même écran que le
 * Calendrier réel du MJ, **sans aucun outil MJ** — ni durée visée, ni
 * annulation, ni confirmation, ni date à la main. Une seule page au lieu des
 * trois onglets d'avant :
 *
 * 1. la prochaine séance confirmée, en tête — c'est ce qu'on vient chercher ;
 * 2. la demande ouverte et la grille à bascule (`AvailabilityGrid.tsx`),
 *    « Toute la table » compris : la RLS de `real_session_availabilities`
 *    ouvre déjà ces réponses à tout membre du monde ;
 * 3. les dates qui se dessinent, en lecture seule ;
 * 4. séances à venir et déjà jouées.
 */
export default function NextSessionPanel({ worldSlug }: { worldSlug: string }) {
  const [openData, setOpenData] = useState<OpenRequestResponse | null>(null);
  const [board, setBoard] = useState<OpenRequestBoard | null>(null);
  const [upcoming, setUpcoming] = useState<RealSession[] | null>(null);
  const [past, setPast] = useState<RealSession[]>([]);
  const [error, setError] = useState(false);

  const loadOpenRequest = useCallback(() => {
    fetch(`/api/worlds/${worldSlug}/scheduling/open-request`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: OpenRequestResponse) => {
        setError(false);
        setOpenData(body);
      })
      .catch(() => setError(true));
  }, [worldSlug]);

  useEffect(loadOpenRequest, [loadOpenRequest]);

  const campaignId = openData?.campaignId ?? null;

  const loadBoard = useCallback(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/scheduling/requests/open`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setBoard)
      .catch(() => setBoard(null));
  }, [campaignId]);

  useEffect(loadBoard, [loadBoard]);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { upcoming: RealSession[]; past: RealSession[] }) => {
        setUpcoming(body.upcoming);
        setPast(body.past);
      })
      .catch(() => {
        setUpcoming([]);
        setPast([]);
      });
  }, [campaignId]);

  function onSaved() {
    loadOpenRequest();
    loadBoard();
  }

  if (error)
    return (
      <div className="flex items-center gap-3 text-sm text-danger">
        Impossible de charger la prochaine session.
        <button type="button" onClick={loadOpenRequest} className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised">
          Réessayer
        </button>
      </div>
    );
  if (!openData) return <p className="text-xs italic text-ink-muted">Chargement…</p>;
  if (!campaignId) return <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;

  const next = upcoming?.[0] ?? null;
  const request = openData.request;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-5 rounded-[14px] border border-edge bg-panel p-5">
        {next ? (
          <>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[14px] border border-accent/60 bg-accent/15">
              <span className="text-xs text-accent">{formatDayMonth(next.scheduled_date).month}</span>
              <span className="font-display text-2xl font-bold leading-none text-ink">{formatDayMonth(next.scheduled_date).day}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Prochaine séance confirmée</div>
              <div className="font-display text-xl font-semibold text-ink">
                {formatDayLong(next.scheduled_date)} · {next.starts_at.slice(0, 5)}
              </div>
              <div className="text-xs text-ink-muted">
                environ {formatHours(next.duration_minutes)} · {untilLabel(next.scheduled_date)}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Prochaine séance</div>
            <div className="text-sm italic text-ink-muted">{upcoming === null ? "Chargement…" : "Aucune séance confirmée pour l'instant."}</div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-edge bg-panel p-4">
        {request ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg text-ink">{request.title} — tes disponibilités</h2>
                <div className="mt-0.5 text-xs text-ink-muted">
                  Le MJ propose {request.candidate_dates.length} jours, entre {request.starts_at.slice(0, 5)} et {request.ends_at.slice(0, 5)}. Coche tout ce qui t&apos;irait.
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${openData.hasResponded ? "bg-success/20 text-success" : "bg-accent/15 text-accent"}`}>
                {openData.hasResponded ? "Réponse enregistrée" : "Pas encore répondu"}
              </span>
            </div>
            <AvailabilityGrid
              key={request.id}
              campaignId={campaignId}
              request={request}
              myResponses={openData.myResponses}
              heatmap={board?.heatmap ?? null}
              expected={board?.expected ?? 0}
              viewerId={board?.viewerId ?? null}
              onSaved={onSaved}
            />
            <p className="text-xs text-ink-muted">Tes cases s&apos;enregistrent toutes seules. Tu peux revenir les modifier tant que le MJ n&apos;a pas fixé la date.</p>
          </>
        ) : (
          <p className="text-sm italic text-ink-muted">Aucune demande de disponibilités pour le moment.</p>
        )}
      </section>

      {request && board && (
        <PossibleDates title="Les dates qui se dessinent" hint="c'est le MJ qui choisit · seuls les jours où quelqu'un est disponible" days={board.days} targetMinutes={board.targetMinutes} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SessionsCard title="Séances à venir" sessions={upcoming ?? []} emptyLabel="Aucune séance confirmée." />
        <SessionsCard title="Déjà jouées" sessions={past} emptyLabel="Aucune séance passée." muted />
      </div>
    </div>
  );
}
