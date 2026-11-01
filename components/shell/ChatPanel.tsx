"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useChatUnread } from "./useChatUnread";
import { useDiceRoll } from "./DiceRollPanel";
import CarteJetSalon from "./CarteJetSalon";
import { jetDepuisLigne, type JetAffiche } from "@/lib/ui/outilDes";
import { cibleDuFil, fusionnerSalon, type FilChat } from "@/lib/ui/salon";
import type { ChatMessageRow } from "@/src/server/repos/chatMessages";
import type { DiceRollRow } from "@/src/server/repos/diceRolls";

interface ChatMember {
  userId: string;
  displayName: string;
  role: string;
}

/**
 * Un fil de la table (V2-M12/M13, V3.1-22) — le salon commun, ou un fil privé
 * MJ/joueur : même composant pour les deux. Côté joueur, `fil.joueurId` est
 * omis (le serveur retombe sur son propre fil, la seule chose qu'il a le droit
 * de voir). Côté MJ, il désigne le joueur dont le fil est ouvert
 * (`ChatThreadsPanel`, le sélecteur).
 *
 * Le salon intercale les jets de la campagne (cartes) : ceux que la route
 * rend, plus ceux que `DiceRollProvider` reçoit déjà en direct — aucun
 * abonnement de plus aux jets (docs/QUOTAS.md Q3).
 *
 * Se charge lui-même (historique + Realtime), même motif que `DiceRollPanel`,
 * mais jamais le même flux : un canal par panneau pour les messages, et un
 * autre dans `ChatUnreadProvider` pour la pastille (celle-ci doit vivre même
 * quand ce panneau n'est pas monté).
 */
export default function ChatPanel({ campaignId, fil, estMj }: { campaignId: string | null; fil: FilChat; estMj: boolean }) {
  const t = useTranslations("chat");
  const supabase = useMemo(() => createClient(), []);
  const { markRead } = useChatUnread();
  const { jetsRecus } = useDiceRoll();
  const [messages, setMessages] = useState<ChatMessageRow[] | "loading" | "error">("loading");
  const [jetsCharges, setJetsCharges] = useState<JetAffiche[]>([]);
  const [members, setMembers] = useState<Map<string, ChatMember>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const estSalon = fil.genre === "salon";
  const joueurId = fil.genre === "prive" ? fil.joueurId : undefined;
  const requeteFil = estSalon ? "fil=salon" : joueurId ? `avec=${joueurId}` : "";

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const filOuvert: FilChat = estSalon ? { genre: "salon" } : { genre: "prive", joueurId };

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
      if (!cancelled) setUserId(userIdRef.current);
    });

    fetch(`/api/campaigns/${campaignId}/chat/messages?limit=100${requeteFil ? `&${requeteFil}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { messages: ChatMessageRow[]; members: ChatMember[]; rolls?: DiceRollRow[] } | null) => {
        if (cancelled || !body) {
          if (!cancelled) setMessages("error");
          return;
        }
        setMessages([...body.messages].reverse());
        setJetsCharges((body.rolls ?? []).map(jetDepuisLigne));
        setMembers(new Map(body.members.map((m) => [m.userId, m])));
      })
      .catch(() => {
        if (!cancelled) setMessages("error");
      });

    markRead(filOuvert);

    const channel = supabase
      .channel(`chat_panel:${campaignId}:${estSalon ? "salon" : (joueurId ?? "self")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          // Filtre cote client : Realtime ne filtre que sur `campaign_id` (un
          // seul critere de colonne possible), jamais le fil precis — le salon
          // est le fil nul, meme motif que `ChatUnreadProvider`.
          if (row.thread_user_id !== cibleDuFil(filOuvert, userIdRef.current)) return;
          setMessages((prev) => (Array.isArray(prev) ? [...prev, row] : [row]));
          markRead(filOuvert);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le reabonnement ne depend que de la campagne et du fil ; `requeteFil` en est derive.
  }, [campaignId, estSalon, joueurId, supabase]);

  const elements = useMemo(
    () => fusionnerSalon(Array.isArray(messages) ? messages : [], jetsCharges, estSalon ? jetsRecus : []),
    [messages, jetsCharges, jetsRecus, estSalon]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [elements.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !campaignId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/chat/messages${requeteFil ? `?${requeteFil}` : ""}`, {
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
    return <p className="text-sm text-ink-muted">{t("aucuneCampagne")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-edge bg-panel-sunken p-3">
        {messages === "loading" && <p className="text-sm text-ink-muted">{t("chargement")}</p>}
        {messages === "error" && <p className="text-sm text-ink-muted">{t("filIntrouvable")}</p>}
        {Array.isArray(messages) && elements.length === 0 && <p className="text-sm text-ink-muted">{t("aucunMessageInvite")}</p>}
        {Array.isArray(messages) &&
          elements.map((element) => {
            if (element.genre === "jet") return <CarteJetSalon key={`jet-${element.id}`} jet={element.jet} estMj={estMj} />;
            const m = element.message;
            const member = members.get(m.sender_id);
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm ${mine ? "self-end bg-accent/15 text-ink" : "bg-panel-raised text-ink"}`}>
                <div className="flex items-baseline gap-2 text-xs text-ink-muted">
                  <span className="font-semibold">{member?.displayName ?? "?"}</span>
                  {member?.role === "gm" && <span className="uppercase tracking-wider">{t("mj")}</span>}
                  <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
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
          placeholder={t("ecrire")}
          aria-label={t("ecrire")}
          rows={2}
          className="flex-1 resize-none rounded-md border border-edge bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          className="shrink-0 rounded-md border border-edge bg-panel-raised px-3 py-2 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {t("envoyer")}
        </button>
      </div>
    </div>
  );
}
