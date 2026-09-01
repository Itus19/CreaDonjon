"use client";

import { useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";

interface ThreadSummary {
  userId: string;
  displayName: string;
  lastMessage: ChatMessageRow | null;
  unreadCount: number;
}

/**
 * Selecteur de fils du MJ (V2-M13, retour utilisateur : "évidemment que
 * pour le MJ il y a une fenêtre de chat par joueur") — une colonne de
 * joueurs (dernier message + pastille), `ChatPanel` a droite pour le fil
 * choisi. Jamais fusionne dans `ChatPanel` lui-meme : ce composant n'existe
 * pas cote joueur (un seul fil, pas de selecteur a lui presenter).
 */
export default function ChatThreadsPanel({ worldSlug, campaignId }: { worldSlug: string; campaignId: string | null }) {
  const [threads, setThreads] = useState<ThreadSummary[] | "loading" | "error">("loading");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/chat/threads`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { threads: ThreadSummary[] }) => {
        setThreads(body.threads);
        setSelected((current) => current ?? body.threads[0]?.userId ?? null);
      })
      .catch(() => setThreads("error"));
  }, [campaignId]);

  if (!campaignId) {
    return <p className="text-sm text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge/60 pr-3">
        {threads === "loading" && <p className="text-xs text-ink-muted">Chargement…</p>}
        {threads === "error" && <p className="text-xs text-ink-muted">Impossible de charger les fils.</p>}
        {Array.isArray(threads) && threads.length === 0 && <p className="text-xs text-ink-muted">Aucun joueur dans cette campagne.</p>}
        {Array.isArray(threads) &&
          threads.map((t) => (
            <button
              key={t.userId}
              type="button"
              onClick={() => setSelected(t.userId)}
              className={`flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-raised ${
                selected === t.userId ? "bg-panel-raised" : ""
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm text-ink">
                {t.displayName}
                {t.unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-ink">
                    {t.unreadCount}
                  </span>
                )}
              </span>
              {t.lastMessage && <span className="w-full truncate text-xs text-ink-muted">{t.lastMessage.body}</span>}
            </button>
          ))}
      </div>
      <div className="min-w-0 flex-1">
        {selected ? (
          <ChatPanel worldSlug={worldSlug} campaignId={campaignId} threadUserId={selected} />
        ) : (
          <p className="text-sm text-ink-muted">Choisissez un joueur.</p>
        )}
      </div>
    </div>
  );
}
