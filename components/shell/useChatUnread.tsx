"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";

/**
 * Pastille de notification du chat (V2-M12/M13, retour utilisateur : "avec
 * notif -> pastille avec nombre de message", puis "une fenetre de chat par
 * joueur") — un seul abonnement Realtime par monde (mont sur `AppShell`,
 * meme niveau que `DiceRollProvider`) plutot qu'un par consommateur :
 * `MjSidebar`/`PlayerShell` (badge) ET `ChatPanel` (remise a zero a
 * l'ouverture) partagent le meme compteur.
 *
 * `isMj` (meme heuristique que `DiceRollProvider.isGm`, `pathname.startsWith`
 * cote AppShell) : purement cosmetique ici (quel(s) fil(s) compter pour la
 * pastille), jamais une verification de securite — RLS/les gardes de route
 * font deja ce travail ailleurs. Un joueur ne compte QUE son propre fil ;
 * le MJ compte tous les fils (n'importe quel joueur peut lui envoyer un
 * message).
 */
interface ChatUnreadValue {
  unreadCount: number;
  /** `threadUserId` omis pour un joueur (son seul fil, toujours le sien) ; requis pour le MJ (quel fil vient d'etre ouvert). */
  markRead: (threadUserId?: string) => void;
}

const ChatUnreadContext = createContext<ChatUnreadValue>({ unreadCount: 0, markRead: () => {} });

export function useChatUnread(): ChatUnreadValue {
  return useContext(ChatUnreadContext);
}

export default function ChatUnreadProvider({
  campaignId,
  isMj,
  children,
}: {
  campaignId: string | null;
  isMj: boolean;
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });

    fetch(`/api/campaigns/${campaignId}/chat/unread-count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { count: number } | null) => {
        if (!cancelled && body) setUnreadCount(body.count);
      })
      .catch(() => {});

    const channel = supabase
      .channel(`chat_unread:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row.sender_id === userIdRef.current) return;
          if (!isMj && row.thread_user_id !== userIdRef.current) return;
          setUnreadCount((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase, isMj]);

  const markRead = useCallback(
    (threadUserId?: string) => {
      if (!campaignId) return;
      if (!isMj) {
        // Un seul fil cote joueur : le vider vide toute la pastille, tout de suite.
        setUnreadCount(0);
        fetch(`/api/campaigns/${campaignId}/chat/read`, { method: "POST" }).catch(() => {});
        return;
      }
      // Cote MJ, ouvrir UN fil ne vide jamais la pastille globale a l'aveugle
      // (les autres fils peuvent rester non lus) — un aller-retour de plus,
      // mais un compte exact plutot qu'une soustraction locale approximative.
      fetch(`/api/campaigns/${campaignId}/chat/read${threadUserId ? `?avec=${threadUserId}` : ""}`, { method: "POST" })
        .then(() => fetch(`/api/campaigns/${campaignId}/chat/unread-count`))
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { count: number } | null) => {
          if (body) setUnreadCount(body.count);
        })
        .catch(() => {});
    },
    [campaignId, isMj]
  );

  const value = useMemo(() => ({ unreadCount, markRead }), [unreadCount, markRead]);
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}
