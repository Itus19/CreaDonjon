"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import GameDateInput from "@/components/shared/GameDateInput";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { SessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";

interface RosterEntry {
  userId: string;
  name: string | null;
}
interface RealSessionRow {
  id: string;
  scheduled_date: string;
  starts_at: string;
}

function formatSessionOption(s: RealSessionRow): string {
  const date = new Date(`${s.scheduled_date}T${s.starts_at}`);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatWrittenAt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Les quatre champs fixes d'une entrée du Livre de sessions (V2.1-3 suite,
 * retour utilisateur) — jamais l'éditeur `infobox` générique : ici les
 * LIBELLÉS sont fixes (pas des `<input>`), seules les VALEURS s'éditent,
 * chacune avec son propre contrôle plutôt que du texte libre.
 *
 * "Rédigé le" n'est modifiable que par le MJ (`isGm`) — posé automatiquement
 * à la soumission (`submitJournalEntry`), l'autrice ne peut plus le changer
 * ensuite : c'est justement ce qui permet au MJ de voir quand elle a
 * réellement écrit, un champ qu'elle pourrait sinon avancer/reculer à sa
 * guise vide le repère de tout son sens.
 */
export default function SessionJournalMetaBlockEditor({
  data,
  onChange,
  worldSlug,
  campaignId,
  isGm,
}: {
  data: SessionJournalMetaBlockData;
  onChange: (data: SessionJournalMetaBlockData) => void;
  worldSlug: string;
  campaignId: string | null;
  isGm: boolean;
}) {
  const [calendar, setCalendar] = useState<CalendarConfigInput | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [sessions, setSessions] = useState<RealSessionRow[]>([]);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/calendar`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { calendar: CalendarConfigInput }) => setCalendar(body.calendar))
      .catch(() => {});
  }, [worldSlug]);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/session-journal/roster`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { roster: RosterEntry[] }) => setRoster(body.roster))
      .catch(() => {});
    fetch(`/api/campaigns/${campaignId}/scheduling/sessions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { upcoming: RealSessionRow[]; past: RealSessionRow[] }) => {
        const all = [...body.past, ...body.upcoming].sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : -1));
        setSessions(all);
      })
      .catch(() => {});
  }, [campaignId]);

  function row(label: string, control: React.ReactNode) {
    return (
      <div className="flex items-baseline gap-3 border-b border-edge/40 py-1.5 last:border-b-0">
        <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        <div className="flex-1">{control}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {row(
        "Date ingame",
        calendar ? (
          <GameDateInput calendar={calendar} value={data.ingameDate} onChange={(ingameDate) => onChange({ ...data, ingameDate })} hidePeriod />
        ) : (
          <span className="text-sm text-ink-muted">Chargement…</span>
        )
      )}

      {row(
        "Rédigé par",
        <Dropdown
          value={data.writtenBy?.userId ?? ""}
          options={roster.map((r) => ({ value: r.userId, label: r.name ?? "?" }))}
          onChange={(userId) => {
            const match = roster.find((r) => r.userId === userId);
            onChange({ ...data, writtenBy: match ? { userId, name: match.name ?? "?" } : null });
          }}
          aria-label="Rédigé par"
        />
      )}

      {row(
        "Rédigé le",
        isGm ? (
          <input
            type="date"
            value={data.writtenAt ? data.writtenAt.slice(0, 10) : ""}
            onChange={(e) => onChange({ ...data, writtenAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })}
            className="rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        ) : (
          <span className="text-sm text-ink">{data.writtenAt ? formatWrittenAt(data.writtenAt) : "—"}</span>
        )
      )}

      {row(
        "Session du",
        <Dropdown
          value={data.realSession?.id ?? ""}
          options={[{ value: "", label: "—" }, ...sessions.map((s) => ({ value: s.id, label: formatSessionOption(s) }))]}
          onChange={(id) => {
            if (!id) {
              onChange({ ...data, realSession: null });
              return;
            }
            const match = sessions.find((s) => s.id === id);
            onChange({ ...data, realSession: match ? { id, label: formatSessionOption(match) } : null });
          }}
          aria-label="Session du"
        />
      )}
    </div>
  );
}
