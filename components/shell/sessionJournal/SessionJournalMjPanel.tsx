"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Dropdown from "@/components/shared/Dropdown";
import GameDateInput from "@/components/shared/GameDateInput";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";
import { formatGameDate } from "@/src/core/calendar/formatDate";

interface RosterEntry {
  userId: string;
  name: string | null;
}
interface Assignment {
  id: string;
  ingame_date: GameDate;
  assigned_to: string;
  status: string;
  entity_id: string | null;
  created_at: string;
  written_at: string | null;
}

function blankDate(calendar: CalendarConfigInput): GameDate {
  return calendar.currentDate ?? { year: 0, month: 1, day: 1, precision: "day", end: null, label: null };
}

/**
 * Panneau MJ "Livre de sessions" (V2.1-3, retour utilisateur : "pouvoir
 * donner le devoir à un joueur") — assigne une entrée à une joueuse pour
 * une date ingame donnée ; la fiche elle-même (titre, blocs) n'est
 * normalement écrite que par l'autrice assignée (édition normale d'une
 * fiche, `submitJournalEntry`) — SAUF quand le MJ se l'attribue à
 * lui-même (retour utilisateur), auquel cas il rédige directement ici
 * avant de rejoindre l'édition normale de la fiche créée.
 */
export default function SessionJournalMjPanel({
  campaignId,
  worldSlug,
  currentUserId,
  initialCalendar,
}: {
  campaignId: string;
  worldSlug: string;
  currentUserId: string;
  initialCalendar: CalendarConfigInput;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [ingameDate, setIngameDate] = useState<GameDate>(() => blankDate(initialCalendar));
  const [assignedTo, setAssignedTo] = useState("");
  const [writing, setWriting] = useState<Assignment | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeyboard({ open: writing !== null, onClose: () => setWriting(null), panelRef });

  function loadRoster() {
    fetch(`/api/campaigns/${campaignId}/session-journal/roster`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { roster: RosterEntry[] }) => {
        setRoster(body.roster);
        setAssignedTo((current) => current || body.roster[0]?.userId || "");
      })
      .catch(() => {});
  }

  function loadAssignments() {
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { assignments: Assignment[] }) => setAssignments(body.assignments))
      .catch(() => {});
  }

  useEffect(loadRoster, [campaignId]);
  useEffect(loadAssignments, [campaignId]);

  function assign() {
    if (!assignedTo) return;
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingameDate, assignedTo }),
    }).then(() => {
      setIngameDate(blankDate(initialCalendar));
      loadAssignments();
    });
  }

  function cancel(id: string) {
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments/${id}`, { method: "DELETE" }).then(() => loadAssignments());
  }

  function openWriting(a: Assignment) {
    setWriting(a);
    setTitle("");
    setError(null);
  }

  function submitWriting() {
    if (!writing) return;
    if (title.trim() === "") {
      setError("Un titre est requis.");
      return;
    }
    setSubmitting(true);
    fetch(`/api/worlds/${worldSlug}/session-journal/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: writing.id, title }),
    })
      .then((res) => (res.ok ? res.json() : res.json().then((b) => Promise.reject(new Error(b.error)))))
      .then((body: { slug: string }) => {
        setWriting(null);
        router.push(`/m/${worldSlug}/f/${body.slug}`);
      })
      .catch((err: Error) => {
        setError(err.message || "Impossible de créer l'entrée.");
        setSubmitting(false);
      });
  }

  const nameByUser = new Map(roster.map((r) => [r.userId, r.name]));
  const pending = assignments.filter((a) => a.status === "pending");
  const written = assignments.filter((a) => a.status === "written");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Assigner le devoir</span>
        <div className="flex flex-wrap items-start gap-3">
          <GameDateInput calendar={initialCalendar} value={ingameDate} onChange={setIngameDate} hidePeriod />
          <Dropdown
            value={assignedTo}
            options={roster.map((r) => ({ value: r.userId, label: r.name ?? "?" }))}
            onChange={setAssignedTo}
            aria-label="Rédactrice"
          />
          <button type="button" onClick={assign} disabled={!assignedTo} className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50">
            Assigner
          </button>
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Devoirs en attente</span>
        <div className="mt-1.5 flex flex-col gap-1">
          {pending.length === 0 && <p className="text-xs italic text-ink-muted">Aucun devoir en attente.</p>}
          {pending.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded bg-panel-sunken px-2 py-1 text-xs text-ink-muted">
              <span>
                {formatGameDate(a.ingame_date, initialCalendar)} — {nameByUser.get(a.assigned_to) ?? "?"}
              </span>
              <span className="flex items-center gap-2">
                {a.assigned_to === currentUserId && (
                  <button type="button" onClick={() => openWriting(a)} className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-medium text-accent-ink hover:bg-accent-hover">
                    Commencer à écrire
                  </button>
                )}
                <button type="button" onClick={() => cancel(a.id)} className="text-danger hover:underline">
                  Annuler
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Entrées rédigées</span>
        <div className="mt-1.5 flex flex-col gap-1">
          {written.length === 0 && <p className="text-xs italic text-ink-muted">Aucune entrée rédigée pour l&apos;instant.</p>}
          {written.map((a) => (
            <span key={a.id} className="rounded bg-panel-sunken px-2 py-1 font-mono text-[10px] text-ink-muted">
              {formatGameDate(a.ingame_date, initialCalendar)} — {nameByUser.get(a.assigned_to) ?? "?"}
            </span>
          ))}
        </div>
      </div>

      {writing &&
        createPortal(
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={() => setWriting(null)} role="dialog" aria-modal="true" aria-label="Rédiger l'entrée">
            <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl outline-none">
              <h2 className="mb-2 text-sm font-semibold text-ink">Titre de l&apos;entrée</h2>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder="Ce que le Grelot Fêlé a vu passer"
                className="w-full rounded border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                autoFocus
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setWriting(null)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted hover:bg-panel">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitWriting}
                  disabled={submitting}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  Créer et rédiger
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
