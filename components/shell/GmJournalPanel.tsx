"use client";

import type { JournalEntry } from "@/src/server/services/activityJournal";
import { useCachedGet } from "./useCachedGet";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Journal fusionne filtre a CE monde (V2-M7, Lot M) — pendant "par monde" de
 * `JournalSection` dans `AdminPanel.tsx` (V2-M6, superadmin, tous mondes).
 * Meme rendu, sans le selecteur de monde : un seul monde, deja connu par la
 * page qui l'affiche. `useCachedGet` (retour utilisateur : "elle a l'air de
 * se recharger a chaque changement d'onglet") — evite le flash
 * "Chargement..." quand ce composant remonte a chaque bascule de section.
 */
export default function GmJournalPanel({ worldSlug }: { worldSlug: string }) {
  const { data } = useCachedGet<{ entries: JournalEntry[] }>(`journal:${worldSlug}`, `/api/worlds/${worldSlug}/journal`);
  const entries = data?.entries ?? null;

  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-edge bg-panel-sunken p-4">
      <h2 className="block-title text-base">Journal</h2>
      {entries === null && <p className="text-xs text-ink-muted">…</p>}
      {entries && entries.length === 0 && <p className="text-xs text-ink-muted">Aucune activité pour l&apos;instant.</p>}
      {entries && entries.length > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-xs">
          {entries.map((entry, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-b border-edge/30 pb-1">
              <div className="flex items-center justify-between gap-2">
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
              </div>
              {entry.blockDetail && <span className="text-[11px] text-ink-muted/80">{entry.blockDetail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
