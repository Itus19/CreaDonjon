"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useChatUnread } from "./useChatUnread";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";

interface ChatMember {
  userId: string;
  displayName: string;
  role: string;
}

interface RelatedEntity {
  id: string;
  name: string;
  slug: string;
}

/**
 * Fil MJ/joueur (V2-M12/M13, retour utilisateur : "ajoute un outil de chat
 * avec le mj", puis "évidemment que pour le MJ il y a une fenêtre de chat
 * par joueur") — meme composant pour les deux cotes. Cote joueur,
 * `threadUserId` omis (le serveur retombe sur son propre fil, la seule
 * chose qu'il a le droit de voir). Cote MJ, `threadUserId` designe le
 * joueur dont le fil est ouvert (`ChatThreadsPanel`, le selecteur).
 *
 * Se charge lui-meme (historique + Realtime), meme motif que
 * `DiceRollPanel`, mais jamais le meme flux : deux abonnements
 * independants, l'un ici pour la liste complete, l'autre dans
 * `ChatUnreadProvider` pour la pastille (celle-ci doit vivre meme quand ce
 * panneau n'est pas monte).
 */
export default function ChatPanel({
  worldSlug,
  campaignId,
  threadUserId,
}: {
  worldSlug: string;
  campaignId: string | null;
  threadUserId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { markRead } = useChatUnread();
  const [messages, setMessages] = useState<ChatMessageRow[] | "loading" | "error">("loading");
  const [members, setMembers] = useState<Map<string, ChatMember>>(new Map());
  const [relatedEntities, setRelatedEntities] = useState<Map<string, RelatedEntity>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const avecParam = threadUserId ? `avec=${threadUserId}` : "";

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });

    fetch(`/api/campaigns/${campaignId}/chat/messages?limit=100${avecParam ? `&${avecParam}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { messages: ChatMessageRow[]; members: ChatMember[]; relatedEntities: RelatedEntity[]; threadUserId: string } | null) => {
        if (cancelled || !body) {
          if (!cancelled) setMessages("error");
          return;
        }
        setMessages([...body.messages].reverse());
        setMembers(new Map(body.members.map((m) => [m.userId, m])));
        setRelatedEntities(new Map(body.relatedEntities.map((e) => [e.id, e])));
      })
      .catch(() => {
        if (!cancelled) setMessages("error");
      });

    markRead(threadUserId);

    const channel = supabase
      .channel(`chat_panel:${campaignId}:${threadUserId ?? "self"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          // Filtre cote client (retour utilisateur, fils separes) : Realtime
          // ne filtre que sur `campaign_id` (un seul critere de colonne
          // possible), jamais le fil precis — meme motif que `ChatUnreadProvider`.
          if (row.thread_user_id !== (threadUserId ?? userId)) return;
          setMessages((prev) => (Array.isArray(prev) ? [...prev, row] : [row]));
          markRead(threadUserId);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `markRead` change a chaque rendu (nouvelle closure sur `unreadCount`, cf. useChatUnread) : le reabonnement ne doit dependre que de `campaignId`/`threadUserId`.
  }, [campaignId, threadUserId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || !campaignId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/chat/messages${avecParam ? `?${avecParam}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) setDraft(body);
    } finally {
      setSending(false);
    }
  }

  if (!campaignId) {
    return <p className="text-sm text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-edge bg-panel-sunken p-3">
        {messages === "loading" && <p className="text-sm text-ink-muted">Chargement…</p>}
        {messages === "error" && <p className="text-sm text-ink-muted">Salon introuvable.</p>}
        {Array.isArray(messages) && messages.length === 0 && (
          <p className="text-sm text-ink-muted">Aucun message pour l&apos;instant — écrivez le premier.</p>
        )}
        {Array.isArray(messages) &&
          messages.map((m) => {
            const member = members.get(m.sender_id);
            const mine = m.sender_id === userId;
            const relatedEntity = m.related_entity_id ? relatedEntities.get(m.related_entity_id) : null;
            return (
              <div key={m.id} className={`flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm ${mine ? "self-end bg-accent/15 text-ink" : "bg-panel-raised text-ink"}`}>
                <div className="flex items-baseline gap-2 text-xs text-ink-muted">
                  <span className="font-semibold">{member?.displayName ?? "?"}</span>
                  {member?.role === "gm" && <span className="uppercase tracking-wider">MJ</span>}
                  <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {relatedEntity && (
                  <Link
                    href={`/m/${worldSlug}/f/${relatedEntity.slug}`}
                    className="w-fit rounded-full border border-edge-strong bg-panel px-2 py-0.5 text-[10px] text-ink-muted hover:text-accent"
                  >
                    Depuis : {relatedEntity.name}
                  </Link>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Écrire un message…"
          rows={2}
          className="flex-1 resize-none rounded-md border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          className="shrink-0 rounded-md border border-edge bg-panel-raised px-3 py-2 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
