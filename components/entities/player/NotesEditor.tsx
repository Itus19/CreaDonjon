"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerNotes } from "@/src/server/services/playerNotes";

const SAVE_DEBOUNCE_MS = 1200;

/** Segment minimal, meme forme que `textToBlockData` cote serveur (`playerNotes.ts`) — jamais deux implementations de la meme serialisation, celle-ci est juste executee cote client (le service serveur est `server-only`, injoignable depuis le navigateur). */
function toBlockData(text: string, userId: string) {
  if (!text) return { __v: 1, segments: [] };
  return {
    __v: 1,
    segments: [
      { id: "notes", blockType: "paragraph", visibility: { level: "user", scopeId: userId }, content: [{ t: "text", v: text }], align: "left" },
    ],
  };
}

/**
 * Notes privees (V2-M7b, coquille joueur) — un simple textarea, sauvegarde
 * automatique apres une pause de frappe. Ecrit via la route generique
 * `/api/blocks/[blockId]` (deja gatee par `canUserEditEntityById`, 5e cas de
 * `canEditEntity`) : rien de nouveau cote sauvegarde, seule la lecture
 * initiale (`GET /api/worlds/[worldSlug]/notes`) est propre a cette page.
 */
export default function NotesEditor({ worldSlug }: { worldSlug: string }) {
  const [notes, setNotes] = useState<PlayerNotes | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/notes`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: PlayerNotes) => {
        setNotes(body);
        setText(body.text);
      })
      .catch(() => setStatus("error"));
  }, [worldSlug]);

  function save(nextText: string, current: PlayerNotes) {
    setStatus("saving");
    fetch(`/api/blocks/${current.blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: current.version,
        display: { label: "Notes", layout: "prose" },
        data: toBlockData(nextText, current.userId),
        visibility: { level: "user", scopeId: current.userId },
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((block: { version: number }) => {
        setNotes((prev) => (prev ? { ...prev, version: block.version } : prev));
        setStatus("saved");
      })
      .catch(() => setStatus("error"));
  }

  function onChange(value: string) {
    setText(value);
    if (!notes) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(value, notes), SAVE_DEBOUNCE_MS);
  }

  if (!notes && status !== "error") {
    return <p className="text-sm text-ink-muted">…</p>;
  }
  if (!notes) {
    return <p className="text-sm text-danger">Impossible de charger les notes.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Mes notes</h2>
        <span className="text-xs text-ink-muted">
          {status === "saving" && "Enregistrement…"}
          {status === "saved" && "Enregistré"}
          {status === "error" && "Échec de l'enregistrement"}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ce que je veux me rappeler..."
        className="min-h-[240px] flex-1 resize-none rounded-md border border-edge bg-panel-sunken p-3 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <p className="text-xs text-ink-muted">Privées — ni le MJ ni les autres joueurs ne les voient.</p>
    </div>
  );
}
