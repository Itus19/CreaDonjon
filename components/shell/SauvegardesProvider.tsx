"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  appliquerSignal,
  compteDuDe,
  demandesARepondre,
  type DemandeSauvegarde,
  type EtatSauvegardes,
  type IssueSauvegarde,
} from "@/lib/ui/sauvegardes";
import {
  appliquerSignalReaction,
  compteReactions,
  fenetresAReprendre,
  fenetresAffichees,
  lignesARepondre,
  separerFenetres,
  type EtatReactions,
  type FenetreReaction,
  type LigneAReponde,
} from "@/lib/ui/reactions";

/**
 * V3.1-112 (ADR 0044) — les sauvegardes demandées de la campagne, pour toute
 * la coquille : la pastille du dé encoché, le bandeau de la cible, les listes
 * du MJ (Initiative, Table) et l'issue revenue à l'outil de l'auteur.
 *
 * La liste en attente arrive avec la page (layout, docs/CABLAGE.md C1) ; un
 * seul canal temps réel la tient ensuite à jour sans relecture (QUOTAS Q3).
 *
 * V3.1-161 (ADR 0075) : les fenêtres de réaction (`roll_windows`) voyagent sur
 * CE MÊME canal, par un second `.on(...)` : aucune connexion de plus.
 * La RLS filtre ce que chacun reçoit. `isMj` est cosmétique (quoi compter),
 * jamais une barrière : c'est `answer_save_request` qui décide en base.
 */
interface SauvegardesValue {
  /** Toutes les demandes en attente que l'utilisateur peut lire. */
  enAttente: DemandeSauvegarde[];
  /** Celles qu'il a à répondre (le MJ : toutes). */
  aRepondre: DemandeSauvegarde[];
  /** La pastille du dé encoché. */
  compte: number;
  /** L'issue d'une demande répondue depuis l'ouverture de la page, ou `undefined`. */
  issue: (requestId: string) => IssueSauvegarde | undefined;
  /** « Laisser le MJ saisir » : replie le bandeau, le temps de la page ; n'écrit rien. */
  laisserAuMj: (requestId: string) => void;
  /** V3.1-161 : les fenêtres de réaction que le bandeau montre (le MJ : toutes les ouvertes). */
  fenetres: FenetreReaction[];
  /** Mes lignes de réaction à répondre. */
  lignesReaction: LigneAReponde[];
  /** Le nombre de mes lignes de réaction à répondre (s'ajoute à la pastille du dé). */
  compteReactions: number;
  /** Mes fenêtres fermées et pas encore reprises : l'écran les reprend une fois. */
  aReprendre: FenetreReaction[];
}

const VIDE: SauvegardesValue = {
  enAttente: [],
  aRepondre: [],
  compte: 0,
  issue: () => undefined,
  laisserAuMj: () => {},
  fenetres: [],
  lignesReaction: [],
  compteReactions: 0,
  aReprendre: [],
};
const SauvegardesContext = createContext<SauvegardesValue>(VIDE);

export function useSauvegardes(): SauvegardesValue {
  return useContext(SauvegardesContext);
}

export default function SauvegardesProvider({
  campaignId,
  userId,
  isMj,
  initiales,
  fenetresInitiales,
  children,
}: {
  campaignId: string | null;
  userId: string | null;
  isMj: boolean;
  /** Les demandes en attente lues par le layout ; `[]` sans campagne. */
  initiales: DemandeSauvegarde[];
  /** V3.1-161 : les fenêtres de réaction ouvertes, lues par le layout ; `[]` sans campagne. */
  fenetresInitiales: FenetreReaction[];
  children: React.ReactNode;
}) {
  const [etat, setEtat] = useState<EtatSauvegardes>({ enAttente: initiales, repondues: {} });
  // Le layout rend les ouvertes ET les fermées pas encore reprises (une reprise survit à un rechargement).
  const [reactions, setReactions] = useState<EtatReactions>(() => separerFenetres(fenetresInitiales));
  const [laissees, setLaissees] = useState<ReadonlySet<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  // Le layout relit la liste quand la page se recharge : on repart d'elle.
  const initialesVues = useRef(initiales);
  useEffect(() => {
    if (initialesVues.current === initiales) return;
    initialesVues.current = initiales;
    setEtat((e) => ({ ...e, enAttente: initiales }));
  }, [initiales]);

  const fenetresVues = useRef(fenetresInitiales);
  useEffect(() => {
    if (fenetresVues.current === fenetresInitiales) return;
    fenetresVues.current = fenetresInitiales;
    setReactions(separerFenetres(fenetresInitiales));
  }, [fenetresInitiales]);

  useEffect(() => {
    if (!campaignId) return;
    const filtre = `campaign_id=eq.${campaignId}`;
    const canal = supabase
      .channel(`save_requests:${campaignId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "save_requests", filter: filtre }, (payload) => {
        setEtat((e) => appliquerSignal(e, { type: "INSERT", ligne: payload.new }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "save_requests", filter: filtre }, (payload) => {
        setEtat((e) => appliquerSignal(e, { type: "UPDATE", ligne: payload.new }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "save_requests", filter: filtre }, (payload) => {
        const id = (payload.old as { id?: unknown }).id;
        if (typeof id === "string") setEtat((e) => appliquerSignal(e, { type: "DELETE", id }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roll_windows", filter: filtre }, (payload) => {
        setReactions((r) => appliquerSignalReaction(r, { type: "INSERT", ligne: payload.new }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "roll_windows", filter: filtre }, (payload) => {
        setReactions((r) => appliquerSignalReaction(r, { type: "UPDATE", ligne: payload.new }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "roll_windows", filter: filtre }, (payload) => {
        const id = (payload.old as { id?: unknown }).id;
        if (typeof id === "string") setReactions((r) => appliquerSignalReaction(r, { type: "DELETE", id }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [campaignId, supabase]);

  const laisserAuMj = useCallback((requestId: string) => {
    setLaissees((s) => new Set(s).add(requestId));
  }, []);

  const value = useMemo<SauvegardesValue>(() => {
    const qui = { userId, isMj, laisseesAuMj: laissees };
    return {
      enAttente: etat.enAttente,
      aRepondre: demandesARepondre(etat.enAttente, qui),
      compte: compteDuDe(etat.enAttente, qui),
      issue: (requestId) => etat.repondues[requestId],
      laisserAuMj,
      fenetres: fenetresAffichees(reactions.enAttente, qui),
      lignesReaction: lignesARepondre(reactions.enAttente, qui),
      compteReactions: compteReactions(reactions.enAttente, qui),
      aReprendre: fenetresAReprendre(reactions.fermees, userId),
    };
  }, [etat, reactions, userId, isMj, laissees, laisserAuMj]);

  return <SauvegardesContext.Provider value={value}>{children}</SauvegardesContext.Provider>;
}
