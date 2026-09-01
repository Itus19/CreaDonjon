"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";

/**
 * Pastille de notification du chat (V2-M12, retour utilisateur : "avec
 * notif -> pastille avec nombre de message") — un seul abonnement Realtime
 * par monde (mont sur `AppShell`, meme niveau que `DiceRollProvider`) plutot
 * qu'un par consommateur : `MjSidebar`/`PlayerShell` (badge) ET `ChatPanel`
 * (remise a zero a l'ouverture) partagent le meme compteur, sans quoi
 * ouvrir le panneau ne ferait jamais redescendre la pastille affichee par
 * la barre laterale (deux etats locaux desynchronises).
 */
interface ChatUnreadValue {
  unreadCount: number;
  markRead: () => void;
}

const ChatUnreadContext = createContext<ChatUnreadValue>({ unreadCount: 0, markRead: () => {} });

export function useChatUnread(): ChatUnreadValue {
  return useContext(ChatUnreadContext);
}

export default function ChatUnreadProvider({ campaignId, children }: { campaignId: string | null; children: React.ReactNode }) {
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
          setUnreadCount((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase]);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/chat/read`, { method: "POST" }).catch(() => {});
  }, [campaignId]);

  const value = useMemo(() => ({ unreadCount, markRead }), [unreadCount, markRead]);
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}
