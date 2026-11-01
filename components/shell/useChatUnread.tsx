"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";
import type { FilChat } from "@/lib/ui/salon";

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
 * font deja ce travail ailleurs. Un joueur compte le salon de table (V3.1-22,
 * thread nul) et son propre fil prive ; le MJ compte le salon et tous les
 * fils (n'importe quel joueur peut lui envoyer un message).
 */
interface ChatUnreadValue {
  unreadCount: number;
  /** Quel fil vient d'etre ouvert : le salon, ou un fil prive (`joueurId` omis cote joueur : c'est le sien, requis cote MJ). */
  markRead: (fil: FilChat) => void;
}

const ChatUnreadContext = createContext<ChatUnreadValue>({ unreadCount: 0, markRead: () => {} });

export function useChatUnread(): ChatUnreadValue {
  return useContext(ChatUnreadContext);
}

export default function ChatUnreadProvider({
  campaignId,
  isMj,
  initialUnreadCount = null,
  children,
}: {
  campaignId: string | null;
  isMj: boolean;
  /** Compte lu par le layout avec la page (V3.1-62, C1) : le premier montage ne le redemande pas. */
  initialUnreadCount?: number | null;
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  /**
   * Le compte du layout vaut pour la campagne et la section (MJ ou joueuse)
   * du premier affichage. Tant qu'elles ne changent pas, on ne le redemande
   * pas ; le mode strict, qui rejoue l'effet, ne le redemande pas non plus.
   */
  const compteInitialPour = useRef(initialUnreadCount !== null ? `${campaignId}|${isMj}` : null);
  const supabase = useMemo(() => createClient(), []);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });

    // Sauf si le layout a deja fourni le compte de cette campagne et de cette section.
    if (compteInitialPour.current !== `${campaignId}|${isMj}`) {
      compteInitialPour.current = null;
      fetch(`/api/campaigns/${campaignId}/chat/unread-count`)
        .then((res) => {
          if (!res.ok) throw new Error(`chat/unread-count : ${res.status}`);
          return res.json() as Promise<{ count: number }>;
        })
        .then((body) => {
          if (!cancelled) setUnreadCount(body.count);
        })
        .catch((erreur: unknown) => {
          console.error("Messages non lus non charges", erreur);
        });
    }

    const channel = supabase
      .channel(`chat_unread:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row.sender_id === userIdRef.current) return;
          // Le salon (thread nul) compte pour tout le monde ; un fil prive, pour son joueur et le MJ.
          if (!isMj && row.thread_user_id !== null && row.thread_user_id !== userIdRef.current) return;
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
    (fil: FilChat) => {
      if (!campaignId) return;
      const requete = fil.genre === "salon" ? "?fil=salon" : fil.joueurId ? `?avec=${fil.joueurId}` : "";
      // Ouvrir UN fil ne vide jamais la pastille globale a l'aveugle (les
      // autres fils, ou le salon, peuvent rester non lus) — un aller-retour de
      // plus, mais un compte exact plutot qu'une soustraction locale approximative.
      fetch(`/api/campaigns/${campaignId}/chat/read${requete}`, { method: "POST" })
        .then(() => fetch(`/api/campaigns/${campaignId}/chat/unread-count`))
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { count: number } | null) => {
          if (body) setUnreadCount(body.count);
        })
        .catch((erreur: unknown) => {
          console.error("Messages non lus non recalcules", erreur);
        });
    },
    [campaignId]
  );

  const value = useMemo(() => ({ unreadCount, markRead }), [unreadCount, markRead]);
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}
