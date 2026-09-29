"use client";

import { useCallback, useEffect, useState } from "react";
import Tabs from "@/components/shared/Tabs";
import AvailabilityPaintGrid from "./AvailabilityPaintGrid";

interface RealSession {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
}
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
interface OpenRequestResponse {
  campaignId: string | null;
  request: AvailabilityRequest | null;
  hasResponded: boolean;
  myResponses: MyResponse[];
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function SessionList({ sessions, emptyLabel }: { sessions: RealSession[] | null; emptyLabel: string }) {
  if (sessions === null) return <p className="text-xs italic text-ink-muted">Chargement…</p>;
  if (sessions.length === 0) return <p className="text-xs italic text-ink-muted">{emptyLabel}</p>;
  return (
    <div className="flex flex-col gap-1">
      {sessions.map((s) => (
        <div key={s.id} className="rounded bg-panel-sunken px-2 py-1 font-mono text-xs text-ink-muted">
          {formatDateLabel(s.scheduled_date)} {s.starts_at.slice(0, 5)} ({Math.round(s.duration_minutes / 60)}h)
        </div>
      ))}
    </div>
  );
}

/**
 * Page "Prochaine session" côté joueuse (V3.1-9, onglet "Mes dispos" refondu
 * V3.1-8) — une page normale de la coquille joueuse, jamais une fenêtre
 * pop-up (retour utilisateur : "à l'image de ce que le joueur peut voir
 * pour les autres onglets"), au même titre que Notes ou Wiki. Se charge
 * elle-même (même doctrine que `NextSessionBadge.tsx`, qui garde sa propre
 * pastille indépendante) : trois onglets — les deux premiers réutilisent
 * `getUpcomingSessions`/`getPastSessions`, le troisième répond à la ronde de
 * demande ouverte sur une grille à peindre (`AvailabilityPaintGrid.tsx`,
 * retour utilisateur : "quasi copié-collé de ce que propose crab.fit").
 */
export default function NextSessionPanel({ worldSlug }: { worldSlug: string }) {
  const [tab, setTab] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<RealSession[] | null>(null);
  const [past, setPast] = useState<RealSession[] | null>(null);
  const [openData, setOpenData] = useState<OpenRequestResponse | null>(null);

  const loadOpenRequest = useCallback(() => {
    fetch(`/api/worlds/${worldSlug}/scheduling/open-request`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setOpenData)
      .catch(() => {});
  }, [worldSlug]);

  useEffect(loadOpenRequest, [loadOpenRequest]);

  useEffect(() => {
    if (!openData?.campaignId) return;
    fetch(`/api/campaigns/${openData.campaignId}/scheduling/sessions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { upcoming: RealSession[]; past: RealSession[] }) => {
        setUpcoming(body.upcoming);
        setPast(body.past);
        setTab((current) => current ?? (body.upcoming.length > 0 ? "upcoming" : "availability"));
      })
      .catch(() => {
        setUpcoming([]);
        setPast([]);
      });
  }, [openData?.campaignId]);

  if (!openData) return <p className="text-xs italic text-ink-muted">Chargement…</p>;
  if (!openData.campaignId) return <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={tab ?? "upcoming"}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "À venir" },
          { value: "past", label: "Passées" },
          { value: "availability", label: "Mes dispos" },
        ]}
      />

      {tab === "upcoming" && <SessionList sessions={upcoming} emptyLabel="Aucune séance confirmée." />}
      {tab === "past" && <SessionList sessions={past} emptyLabel="Aucune séance passée." />}
      {tab === "availability" &&
        (openData.request ? (
          <AvailabilityPaintGrid campaignId={openData.campaignId} request={openData.request} myResponses={openData.myResponses} onSaved={loadOpenRequest} />
        ) : (
          <p className="text-xs italic text-ink-muted">Aucune demande de disponibilités n&apos;est ouverte pour le moment.</p>
        ))}
    </div>
  );
}
