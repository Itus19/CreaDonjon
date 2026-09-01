"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ChatPanel from "./ChatPanel";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";

interface ThreadSummary {
  userId: string;
  displayName: string;
  lastMessage: ChatMessageRow | null;
  unreadCount: number;
}

function sortThreads(threads: ThreadSummary[]): ThreadSummary[] {
  return [...threads].sort((a, b) => (b.lastMessage?.created_at ?? "").localeCompare(a.lastMessage?.created_at ?? ""));
}

/**
 * Selecteur de fils du MJ (V2-M13, retour utilisateur : "évidemment que
 * pour le MJ il y a une fenêtre de chat par joueur") — une colonne de
 * joueurs (dernier message + pastille), `ChatPanel` a droite pour le fil
 * choisi. Jamais fusionne dans `ChatPanel` lui-meme : ce composant n'existe
 * pas cote joueur (un seul fil, pas de selecteur a lui presenter).
 *
 * Abonnement Realtime local (retour utilisateur : "corrige" la pastille
 * par fil qui ne bougeait qu'au rechargement) — distinct de celui de
 * `ChatPanel` (limite au fil ouvert) ET de `ChatUnreadProvider` (total
 * global) : ici, MET A JOUR la pastille de CHAQUE fil de la liste, y
 * compris ceux non ouverts, sans quoi le MJ ne verrait un message arrive
 * dans un autre fil qu'en rechargeant toute la page.
 */
export default function ChatThreadsPanel({ worldSlug, campaignId }: { worldSlug: string; campaignId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [threads, setThreads] = useState<ThreadSummary[] | "loading" | "error">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });

    fetch(`/api/campaigns/${campaignId}/chat/threads`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { threads: ThreadSummary[] }) => {
        if (cancelled) return;
        setThreads(body.threads);
        setSelected((current) => current ?? body.threads[0]?.userId ?? null);
      })
      .catch(() => {
        if (!cancelled) setThreads("error");
      });

    const channel = supabase
      .channel(`chat_threads:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setThreads((prev) => {
            if (!Array.isArray(prev)) return prev;
            const isOpenThread = row.thread_user_id === selectedRef.current;
            const isMine = row.sender_id === userIdRef.current;
            const updated = prev.map((t) =>
              t.userId === row.thread_user_id
                ? { ...t, lastMessage: row, unreadCount: isMine || isOpenThread ? t.unreadCount : t.unreadCount + 1 }
                : t
            );
            return sortThreads(updated);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase]);

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
              onClick={() => {
                setSelected(t.userId);
                setThreads((prev) => (Array.isArray(prev) ? prev.map((x) => (x.userId === t.userId ? { ...x, unreadCount: 0 } : x)) : prev));
              }}
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
