"use client";

import { useEffect, useState } from "react";
import Tabs from "@/components/shared/Tabs";
import AvailabilityCalendar from "./AvailabilityCalendar";

interface RealSession {
  id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
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
 * Contenu du panneau "Prochaine session" côté joueuse (V3.1-9) : trois
 * onglets qui réutilisent ce qui existait déjà côté service
 * (`getUpcomingSessions`/`getPastSessions`, jamais consultés côté joueuse
 * avant ce ticket — seul le MJ les voyait, `SchedulingMjPanel.tsx`).
 *
 * L'onglet "Mes disponibilités" reste pour l'instant toujours présent — le
 * ticket V3.1-8 (demande structurée du MJ, avec dates candidates) n'est pas
 * encore fait, et le conditionner à "une demande est ouverte" comme prévu
 * au ticket retirerait aux joueuses tout moyen de renseigner leurs
 * disponibilités tant que V3.1-8 n'existe pas — régression non voulue. À
 * revoir quand V3.1-8 arrivera.
 */
export default function NextSessionPanel({ campaignId, hasUpcoming }: { campaignId: string; hasUpcoming: boolean }) {
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
      {tab === "availability" && <AvailabilityCalendar campaignId={campaignId} />}
    </div>
  );
}
