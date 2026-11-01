"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Tabs from "@/components/shared/Tabs";
import ChatPanel from "./ChatPanel";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";
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

/** Pastille de non-lus, la même partout dans le chat (recette de la pastille d'accent). */
function PastilleNonLus({ n }: { n: number }) {
  const t = useTranslations("chat");
  if (n <= 0) return null;
  return (
    <span
      aria-label={t("nonLus", { n })}
      className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-ink"
    >
      {n}
    </span>
  );
}

/**
 * Le chat de la table (V2-M13, V3.1-22, ADR 0038, planche « Chat — B
 * retenue »). Deux dispositions pour deux rôles :
 * - MJ : le salon de table toujours en grand ; les joueurs sont des pastilles
 *   « Fils privés » (avec leurs non-lus) ; toucher l'une ouvre son fil privé en
 *   colonne à droite — en panneau par-dessus le salon quand la fenêtre est
 *   étroite (requête de conteneur, pas largeur d'écran).
 * - Joueur : liste « Conversations » à gauche (salon, MJ en privé), la
 *   conversation choisie à droite.
 * Sous 768 px, les deux se réduisent à une pilule à deux entrées.
 *
 * Abonnement Realtime local, distinct de celui de `ChatPanel` (limité au fil
 * ouvert) ET de `ChatUnreadProvider` (total global) : ici, MET À JOUR le
 * dernier message et la pastille de CHAQUE entrée de la liste, y compris
 * celles non ouvertes.
 */
export default function ChatThreadsPanel({ campaignId, role }: { campaignId: string | null; role: "mj" | "joueur" }) {
  const t = useTranslations("chat");
  if (!campaignId) {
    return <p className="text-sm text-ink-muted">{t("aucuneCampagne")}</p>;
  }
  return role === "mj" ? <ChatMj campaignId={campaignId} /> : <ChatJoueur campaignId={campaignId} />;
}

// ---- MJ ---------------------------------------------------------------------

function ChatMj({ campaignId }: { campaignId: string }) {
  const t = useTranslations("chat");
  const supabase = useMemo(() => createClient(), []);
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [threads, setThreads] = useState<ThreadSummary[] | "loading" | "error">("loading");
  /** Le fil privé ouvert (`null` : fermé — le salon reste seul). */
  const [selected, setSelected] = useState<string | null>(null);
  /** Téléphone : la pilule « Salon de table / Fils privés ». */
  const [vue, setVue] = useState<"salon" | "prives">("salon");
  const ouvertRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Le fil réellement affiché : sur téléphone, seulement dans la vue « Fils privés ».
  const filAffiche = estTelephone && vue !== "prives" ? null : selected;
  useEffect(() => {
    ouvertRef.current = filAffiche;
  }, [filAffiche]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });

    fetch(`/api/campaigns/${campaignId}/chat/threads`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { threads: ThreadSummary[] }) => {
        if (!cancelled) setThreads(body.threads);
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
          // Le salon n'a pas de pastille de joueur : son panneau s'en charge.
          if (row.thread_user_id === null) return;
          setThreads((prev) => {
            if (!Array.isArray(prev)) return prev;
            const isOpenThread = row.thread_user_id === ouvertRef.current;
            const isMine = row.sender_id === userIdRef.current;
            const updated = prev.map((th) =>
              th.userId === row.thread_user_id
                ? { ...th, lastMessage: row, unreadCount: isMine || isOpenThread ? th.unreadCount : th.unreadCount + 1 }
                : th
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

  function ouvrirFil(userId: string) {
    setSelected(userId);
    setThreads((prev) => (Array.isArray(prev) ? prev.map((x) => (x.userId === userId ? { ...x, unreadCount: 0 } : x)) : prev));
  }

  const liste = Array.isArray(threads) ? threads : [];
  const filChoisi = liste.find((th) => th.userId === filAffiche) ?? null;
  // Téléphone, vue « Fils privés » : sans choix, on ouvre le premier fil.
  const filTelephone = estTelephone && vue === "prives" ? (liste.find((th) => th.userId === selected) ?? liste[0] ?? null) : null;

  const pastilles = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label={t("filsPrives")}>
      <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("filsPrives")}</span>
      {threads === "loading" && <span className="text-xs text-ink-muted">{t("chargement")}</span>}
      {threads === "error" && <span className="text-xs text-ink-muted">{t("filsImpossibles")}</span>}
      {Array.isArray(threads) && threads.length === 0 && <span className="text-xs text-ink-muted">{t("aucunJoueur")}</span>}
      {liste.map((th) => {
        const actif = (estTelephone ? filTelephone?.userId : filAffiche) === th.userId;
        return (
          <button
            key={th.userId}
            type="button"
            onClick={() => ouvrirFil(th.userId)}
            aria-pressed={actif}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-panel-raised ${
              actif ? "border-edge-strong bg-panel-raised text-ink" : "border-edge text-ink-soft"
            }`}
          >
            {th.displayName}
            <PastilleNonLus n={th.unreadCount} />
          </button>
        );
      })}
    </div>
  );

  if (estTelephone) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Tabs
          aria-label={t("choixConversation")}
          value={vue}
          onChange={(v) => {
            setVue(v);
            if (v === "prives" && !selected && liste[0]) ouvrirFil(liste[0].userId);
          }}
          items={[
            { value: "salon", label: t("salonTitre") },
            { value: "prives", label: t("filsPrives") },
          ]}
        />
        {vue === "salon" ? (
          <div className="min-h-0 flex-1">
            <ChatPanel campaignId={campaignId} fil={{ genre: "salon" }} estMj />
          </div>
        ) : (
          <>
            {pastilles}
            <div className="min-h-0 flex-1">
              {filTelephone ? (
                <ChatPanel key={filTelephone.userId} campaignId={campaignId} fil={{ genre: "prive", joueurId: filTelephone.userId }} estMj />
              ) : (
                <p className="text-sm text-ink-muted">{t("choisirJoueur")}</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <h2 className="text-sm font-semibold text-ink">{t("salonTitre")}</h2>
        <p className="text-xs text-ink-muted">{t("salonSousTitre", { n: liste.length })}</p>
      </div>
      {pastilles}
      <div className="relative flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <ChatPanel campaignId={campaignId} fil={{ genre: "salon" }} estMj />
        </div>
        {filChoisi && (
          // Colonne à droite quand la fenêtre est large, panneau par-dessus le salon sinon (requête de conteneur).
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[min(100%,22rem)] flex-col gap-2 rounded-md border border-edge-strong bg-panel p-3 shadow-lg @[40rem]:static @[40rem]:w-80 @[40rem]:shrink-0 @[40rem]:shadow-none">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-ink">{filChoisi.displayName}</h3>
                <p className="text-xs text-ink-muted">{t("enPrive")}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t("fermerFil", { nom: filChoisi.displayName })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel key={filChoisi.userId} campaignId={campaignId} fil={{ genre: "prive", joueurId: filChoisi.userId }} estMj />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---- joueur -----------------------------------------------------------------

type Conversation = "salon" | "prive";

function ChatJoueur({ campaignId }: { campaignId: string }) {
  const t = useTranslations("chat");
  const supabase = useMemo(() => createClient(), []);
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [choix, setChoix] = useState<Conversation>("salon");
  const [derniers, setDerniers] = useState<Record<Conversation, ChatMessageRow | null>>({ salon: null, prive: null });
  const [nonLus, setNonLus] = useState<Record<Conversation, number>>({ salon: 0, prive: 0 });
  const choixRef = useRef<Conversation>("salon");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    choixRef.current = choix;
  }, [choix]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });

    // Le dernier message de chaque conversation (une ligne chacun).
    const dernier = (requete: string) =>
      fetch(`/api/campaigns/${campaignId}/chat/messages?limit=1${requete}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ messages: ChatMessageRow[] }>) : Promise.reject(new Error(`chat/messages : ${res.status}`))))
        .then((body) => body.messages[0] ?? null);
    Promise.all([dernier("&fil=salon"), dernier("")])
      .then(([salon, prive]) => {
        if (!cancelled) setDerniers({ salon, prive });
      })
      .catch((erreur: unknown) => {
        console.error("Derniers messages du chat non charges", erreur);
      });

    const channel = supabase
      .channel(`chat_conversations:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "campaign_chat_messages", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          const conversation: Conversation | null = row.thread_user_id === null ? "salon" : row.thread_user_id === userIdRef.current ? "prive" : null;
          if (!conversation) return;
          setDerniers((prev) => ({ ...prev, [conversation]: row }));
          if (row.sender_id !== userIdRef.current && choixRef.current !== conversation) {
            setNonLus((prev) => ({ ...prev, [conversation]: prev[conversation] + 1 }));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase]);

  function choisir(conversation: Conversation) {
    setChoix(conversation);
    setNonLus((prev) => ({ ...prev, [conversation]: 0 }));
  }

  const panneau = (
    <ChatPanel key={choix} campaignId={campaignId} fil={choix === "salon" ? { genre: "salon" } : { genre: "prive" }} estMj={false} />
  );

  if (estTelephone) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Tabs
          aria-label={t("choixConversation")}
          value={choix}
          onChange={choisir}
          items={[
            { value: "salon", label: t("salonTitre") },
            { value: "prive", label: t("mjEnPrive") },
          ]}
        />
        <div className="min-h-0 flex-1">{panneau}</div>
      </div>
    );
  }

  const entrees: { id: Conversation; titre: string }[] = [
    { id: "salon", titre: t("salonTitre") },
    { id: "prive", titre: t("mjEnPrive") },
  ];
  return (
    <div className="flex h-full min-h-0 gap-4">
      <nav aria-label={t("conversations")} className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge/60 pr-3">
        <h2 className="px-2 pb-1 text-xs font-bold uppercase tracking-widest text-ink-muted">{t("conversations")}</h2>
        {entrees.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => choisir(e.id)}
            aria-current={choix === e.id}
            className={`flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-raised ${
              choix === e.id ? "bg-panel-raised" : ""
            }`}
          >
            <span className="flex w-full items-center justify-between gap-2 text-sm text-ink">
              {e.titre}
              <PastilleNonLus n={nonLus[e.id]} />
            </span>
            <span className="w-full truncate text-xs text-ink-muted">{derniers[e.id]?.body ?? t("aucunMessage")}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{panneau}</div>
    </div>
  );
}
