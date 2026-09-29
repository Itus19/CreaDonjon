"use client";

import { useEffect, useState } from "react";
import Tabs from "@/components/shared/Tabs";
import AvailabilityRequestResponse from "./AvailabilityRequestResponse";

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
 * Contenu du panneau "Prochaine session" côté joueuse (V3.1-9, onglet
 * "Mes dispos" refondu V3.1-8) : trois onglets — les deux premiers
 * réutilisent `getUpcomingSessions`/`getPastSessions` (jamais consultés
 * côté joueuse avant V3.1-9), le troisième répond à la ronde de demande
 * ouverte (`AvailabilityRequestResponse.tsx`) plutôt qu'au calendrier libre
 * d'avant V3.1-8.
 */
export default function NextSessionPanel({
  campaignId,
  hasUpcoming,
  request,
  myResponses,
  onResponded,
}: {
  campaignId: string;
  hasUpcoming: boolean;
  request: AvailabilityRequest | null;
  myResponses: MyResponse[];
  onResponded: () => void;
}) {
  const [tab, setTab] = useState(hasUpcoming ? "upcoming" : "availability");
  const [upcoming, setUpcoming] = useState<RealSession[] | null>(null);
  const [past, setPast] = useState<RealSession[] | null>(null);

  useEffect(() => {
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

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={tab}
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
        (request ? (
          <AvailabilityRequestResponse campaignId={campaignId} request={request} myResponses={myResponses} onSaved={onResponded} />
        ) : (
          <p className="text-xs italic text-ink-muted">Aucune demande de disponibilités n&apos;est ouverte pour le moment.</p>
        ))}
    </div>
  );
}
