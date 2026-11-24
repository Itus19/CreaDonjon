"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RemoteTableView } from "@/src/server/services/remotePlay";

/**
 * Le jeu à distance (ADR 0103), côté navigateur : la vue arrive avec la page
 * (C1), puis se relit seulement quand la base signale un changement.
 *
 * Un canal par écran (QUOTAS Q3), deux écoutes filtrées sur la session :
 * `session_events` (un message, une réponse) et `roll_requests` (une demande,
 * une annulation). Realtime applique la RLS : un secret n'alerte que ses
 * lecteurs. Plusieurs signaux rapprochés ne font qu'une relecture (300 ms).
 * Jamais de sondage (Q2).
 */
export function useTableADistance(initial: RemoteTableView) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<RemoteTableView>(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const luJusqua = useRef<number>(initial.lastReadSeq ?? 0);
  const { campaignId, sessionId } = initial;

  const recharger = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/distance/fil`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErreur(body?.error ?? "Le fil n'a pas pu se recharger.");
        return;
      }
      setView((await res.json()) as RemoteTableView);
      setErreur(null);
    } catch (e) {
      console.error("Relecture du fil à distance impossible", e);
      setErreur("Connexion perdue. Le fil se rechargera au prochain message.");
    }
  }, [campaignId]);

  const signaler = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => void recharger(), 300);
  }, [recharger]);

  useEffect(() => {
    const channel = supabase
      .channel(`distance:${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_events", filter: `session_id=eq.${sessionId}` }, signaler)
      .on("postgres_changes", { event: "*", schema: "public", table: "roll_requests", filter: `session_id=eq.${sessionId}` }, signaler)
      .subscribe();
    // Revenir sur l'onglet relit le fil : un signal a pu se perdre pendant la veille de l'appareil.
    const auRetour = () => {
      if (document.visibilityState === "visible") signaler();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      document.removeEventListener("visibilitychange", auRetour);
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, signaler]);

  /** Note le dernier message lu, seulement si l'onglet est visible et qu'il y a du neuf. */
  const marquerLu = useCallback(async () => {
    const dernier = view.feed.at(-1)?.seq ?? 0;
    if (dernier <= luJusqua.current || document.visibilityState !== "visible") return;
    luJusqua.current = dernier;
    setView((v) => ({ ...v, unread: 0, lastReadSeq: dernier }));
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/distance/lu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seq: dernier }),
      });
      if (!res.ok) console.error("Dernier lu non noté", res.status);
    } catch (e) {
      console.error("Dernier lu non noté", e);
    }
  }, [campaignId, view.feed]);

  useEffect(() => {
    void marquerLu();
    const auRetour = () => void marquerLu();
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [marquerLu]);

  /** Envoie un geste ; rend le message d'erreur à afficher, ou null. La relecture vient du temps réel, et d'ici par sûreté. */
  const envoyer = useCallback(
    async (chemin: string, corps: unknown): Promise<string | null> => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/distance/${chemin}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corps ?? {}),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          return body?.error ?? "Le geste n'a pas abouti.";
        }
        signaler();
        return null;
      } catch (e) {
        console.error("Geste du jeu à distance non envoyé", e);
        return "Connexion perdue : rien n'a été envoyé.";
      }
    },
    [campaignId, signaler]
  );

  return { view, erreur, envoyer };
}
