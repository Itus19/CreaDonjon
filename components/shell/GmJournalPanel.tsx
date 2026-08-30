"use client";

import { useEffect, useState } from "react";
import type { JournalEntry } from "@/src/server/services/activityJournal";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Journal fusionne filtre a CE monde (V2-M7, Lot M) — pendant "par monde" de
 * `JournalSection` dans `AdminPanel.tsx` (V2-M6, superadmin, tous mondes).
 * Meme rendu, sans le selecteur de monde : un seul monde, deja connu par la
 * page qui l'affiche (`app/m/[worldSlug]/mj/page.tsx`).
 */
export default function GmJournalPanel({ worldSlug }: { worldSlug: string }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/journal`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { entries: JournalEntry[] }) => setEntries(body.entries))
      .catch(() => setLoadError("Impossible de charger le journal."));
  }, [worldSlug]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Journal</h2>
      {loadError && <p className="text-xs text-danger">{loadError}</p>}
      {entries === null && !loadError && <p className="text-xs text-ink-muted">…</p>}
      {entries && entries.length === 0 && <p className="text-xs text-ink-muted">Aucune activité pour l&apos;instant.</p>}
      {entries && entries.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-xs">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-edge/30 pb-1">
              <span className="text-ink-muted">
                <span className={entry.source === "wiki" ? "text-accent" : "text-ink"}>
                  {entry.source === "wiki" ? "wiki" : "jeu"}
                </span>
                {"  "}
                {entry.label}
                {entry.entityName && <> — {entry.entityName}</>}
                {entry.blockLabel && <> ({entry.blockLabel})</>}
              </span>
              <span className="shrink-0 text-ink-muted">
                {entry.accountName} · {formatDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
