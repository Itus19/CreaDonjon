"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionLogBlockData } from "@/src/core/schemas/blocks/sessionLog";

interface SessionInfo {
  id: string;
  title: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

interface SessionEventInfo {
  id: string;
  seq: number;
  kind: string;
  actor: string;
  payload: { note?: string } | null;
  created_at: string;
}

const ACTOR_LABELS_FR: Record<string, string> = { player: "Joueur", gm: "MJ", ai: "IA", system: "Système" };
const KIND_LABELS_FR: Record<string, string> = {
  player_action: "Action",
  narration: "Narration",
  roll: "Jet de dé",
  rule_application: "Règle",
  world_update: "Mise à jour",
  note: "Note",
  system: "Système",
  combat: "Combat",
};

function formatEvent(event: SessionEventInfo): string {
  if (event.payload?.note) return event.payload.note;
  return `${KIND_LABELS_FR[event.kind] ?? event.kind} (${ACTOR_LABELS_FR[event.actor] ?? event.actor})`;
}

/**
 * Bloc `session_log` (V2-H4) : le resume redactionnel modifie ici est
 * `sessions.summary` (docs/SCHEMA.md §12), jamais une copie dans la donnee
 * du bloc — `sessionId` est la seule chose que ce bloc stocke lui-meme.
 */
export default function SessionLogBlockEditor({
  blockId,
  version,
  data,
  onBlockRefreshed,
}: {
  blockId: string;
  version: number;
  data: SessionLogBlockData;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [events, setEvents] = useState<SessionEventInfo[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    if (data.sessionId || attachedRef.current) return;
    attachedRef.current = true;
    fetch(`/api/blocks/${blockId}/session-log/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { block: { id: string; data: unknown; version: number } }) => onBlockRefreshed(body.block))
      .catch(async (res) => {
        const body = await res.json?.().catch(() => null);
        setError(body?.error ?? "Impossible de rattacher ce bloc à une séance.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sessionId, blockId]);

  useEffect(() => {
    if (!data.sessionId) return;
    const sessionId = data.sessionId;
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((s: SessionInfo | null) => {
        if (s) {
          setSession(s);
          setSummary(s.summary ?? "");
        }
      });
    fetch(`/api/sessions/${sessionId}/events`)
      .then((res) => (res.ok ? res.json() : []))
      .then((e: SessionEventInfo[]) => setEvents(e));
  }, [data.sessionId]);

  async function saveSummary() {
    if (!data.sessionId) return;
    await fetch(`/api/sessions/${data.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
  }

  if (error) return <p className="text-xs text-danger">{error}</p>;
  if (!data.sessionId || !session) return <p className="text-sm text-ink-muted">Rattachement à la séance en cours…</p>;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-ink-muted">
        Séance du {new Date(session.started_at).toLocaleDateString("fr-FR")}
        {session.ended_at ? " — terminée" : " — en cours"}
      </span>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onBlur={saveSummary}
        placeholder="Compte rendu de la séance…"
        rows={4}
        className="w-full resize-y rounded-md border border-edge bg-transparent p-2 text-sm text-ink outline-none focus:border-edge-strong"
      />
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Journal</span>
        {events.length === 0 && <p className="text-xs italic text-ink-muted">Aucun événement pour l&apos;instant.</p>}
        <ul className="flex flex-col gap-1 text-xs text-ink-muted">
          {events.map((event) => (
            <li key={event.id}>
              <span className="text-ink">{formatEvent(event)}</span>{" "}
              <span>— {new Date(event.created_at).toLocaleTimeString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
