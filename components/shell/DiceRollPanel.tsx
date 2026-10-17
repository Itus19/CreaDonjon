"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";
import OutilDes, { PanneauFlottant, type PositionPanneau } from "./OutilDes";
import type { AdvantageState } from "@/src/core/rules/action";
import type { Ability, Skill } from "@/src/core/rules/sheet";
import { advantagePairFromTrace } from "@/src/core/dice/diceTool";
import { naturalD20FromTrace } from "@/src/core/dice/rollAttribution";
import { extractDiceGroups, parseRollDetail } from "@/src/core/dice/parseRollDetail";
import type { DiceRollRow } from "@/src/server/repos/diceRolls";
import {
  estSecret,
  fusionnerJets,
  lireDcPrive,
  lireDiffusionDd,
  preReglageDepuisFiche,
  type ApercuFiche,
  type JetAffiche,
  type PreReglage,
} from "@/lib/ui/outilDes";

/**
 * L'outil de dés unique (V3.1-33) : ce fichier est son FOURNISSEUR. Il garde
 * ce qui doit vivre hors de l'outil — Realtime sur `dice_rolls` (RLS déjà
 * filtrée, migration 20260831091000), historique chargé à la première
 * ouverture (V3.1-62), DD diffusé par le MJ, dalle du rail, toast du
 * téléphone — et ouvre le corps (`OutilDes.tsx`) dans le bon conteneur :
 * feuille du bas sous 768 px, panneau ancré au dé du rail au-delà.
 *
 * Toute la logique de jeu (modificateur, verdict, visibilité) vit côté
 * serveur (checkRolls.ts) : l'écran n'affiche que ce que le serveur renvoie.
 */

function jetDepuisLigne(row: DiceRollRow): JetAffiche {
  const detail = parseRollDetail(row.detail);
  return {
    id: row.id,
    who: detail.who ?? (row.rolled_by === "gm" ? "MJ" : "Joueur"),
    what: detail.what ?? "Jet",
    chips: detail.chips ?? [],
    total: row.result,
    dc: detail.dc ?? null,
    dcPrivate: lireDcPrive(row.detail),
    verdict: detail.verdict ?? null,
    naturalD20: naturalD20FromTrace(detail.trace ?? []) ?? null,
    secret: estSecret(row.visibility_level),
    groups: extractDiceGroups(detail.trace),
    pair: advantagePairFromTrace(detail.trace),
    createdAt: row.created_at,
  };
}

// ---- contexte : ouvre l'outil depuis n'importe quelle fiche ----

interface DiceRollContextValue {
  isGm: boolean;
  /**
   * Ouvre l'outil pré-rempli (V3.1-33) : titre, dés, modificateur, avantage,
   * secret. Avec une `action`, « Lancer » appelle la route de la fiche.
   */
  openDiceTool: (preset: PreReglage) => void;
  /** Les quatre ci-dessous OUVRENT l'outil sur le test de la fiche ; le jet part de « Lancer ». */
  rollAbility: (entityId: string, ability: Ability, advantage: AdvantageState, apercu: ApercuFiche) => void;
  rollSkill: (entityId: string, skill: Skill, advantage: AdvantageState, apercu: ApercuFiche) => void;
  rollSave: (entityId: string, ability: Ability, advantage: AdvantageState, apercu: ApercuFiche) => void;
  rollInitiative: (entityId: string, advantage: AdvantageState, apercu: ApercuFiche) => void;
  /** Ouvre l'outil en « Jet libre » (1d20, 0) : le dé de la dalle « Outils » du rail n'a pas de volet propre. */
  ouvrirVolet: () => void;
  /**
   * Signale une dalle « Outils » (rail, `"ordinateur"`) ou une barre flottante
   * (téléphone, `"telephone"`) montée ; renvoie de quoi la retirer. Tant qu'il
   * y en a une pour une portée, le bouton flottant se cache sur cette portée
   * seulement — une page de monde sans rail ni barre le garde, sinon elle
   * n'aurait plus de dé. `ancre` : le dé du rail, auquel le panneau s'accroche.
   */
  enregistrerDalle: (portee: PorteeDalle, ancre?: RefObject<HTMLElement | null>) => () => void;
}

/** Où le dé de la coquille vit : le rail (à partir de 768 px) ou la barre flottante (en dessous). */
export type PorteeDalle = "ordinateur" | "telephone";

const DiceRollContext = createContext<DiceRollContextValue | null>(null);

/** Pour un clic sur une fiche (stat/compétence/sauvegarde/initiative) : ouvre l'outil, jamais un second affichage local. */
export function useDiceRoll(): DiceRollContextValue {
  const ctx = useContext(DiceRollContext);
  if (!ctx) throw new Error("useDiceRoll doit etre appele sous DiceRollProvider (AppShell.tsx)");
  return ctx;
}

const HISTORY_LIMIT = 30;

/** État de l'historique des jets, chargé à la première ouverture de l'outil (V3.1-62). */
type EtatHistorique = "sans-campagne" | "chargement" | "erreur" | "charge";

/** Largeur du panneau (px) et marge au bord de l'écran, pour ne jamais le laisser sortir. */
const LARGEUR_PANNEAU = 344;
const MARGE_ECRAN = 8;

export default function DiceRollProvider({
  campaignId,
  isGm,
  children,
}: {
  campaignId: string | null;
  isGm: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("outilDes");
  const supabase = useMemo(() => createClient(), []);
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  /** Le préréglage de l'ouverture en cours ; `cle` change à chaque ouverture, pour repartir d'un outil neuf. */
  const [preset, setPreset] = useState<PreReglage | null>(null);
  const [cle, setCle] = useState(0);
  const [position, setPosition] = useState<PositionPanneau | null>(null);
  const [rolls, setRolls] = useState<JetAffiche[]>([]);
  const [historique, setHistorique] = useState<{ pour: string; etat: "charge" | "erreur" } | null>(null);
  const etatHistorique: EtatHistorique = !campaignId ? "sans-campagne" : historique?.pour === campaignId ? historique.etat : "chargement";
  const [toast, setToast] = useState<JetAffiche | null>(null);
  /**
   * DD (V2-M11 suite, V3.1-33) : diffusé par le MJ aux joueurs via Realtime
   * broadcast (éphémère, jamais persisté). `ddPrive` : côté MJ, l'interrupteur
   * « DD privé » (diffusé comme `{ dc: null, private: true }`) ; côté joueur,
   * la valeur reçue — il lit « contre DD ? » et lance sans DD.
   */
  const [dd, setDd] = useState<number | null>(null);
  const [ddPrive, setDdPrive] = useState(false);
  /** La valeur actuelle de `dd` vient d'une diffusion du MJ — retombe à false dès que CE client la change lui-même. */
  const [ddDeMj, setDdDeMj] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const minuteurDdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ancreRef = useRef<RefObject<HTMLElement | null> | null>(null);

  // `open` change à chaque ouverture/fermeture : une ref plutôt qu'une
  // dépendance évite de réabonner Realtime à chaque clic.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /**
   * Ouvre l'outil. À partir de 768 px : le panneau s'ancre au dé de la dalle
   * « Outils » du rail (même calcul que le menu flottant du rail), ou en bas
   * à droite si aucun rail n'est monté. Sous 768 px : la feuille du bas.
   */
  const ouvrir = useCallback((nouveau: PreReglage | null) => {
    const ancre = ancreRef.current?.current;
    if (ancre && ancre.isConnected && !window.matchMedia(WINDOWS_MOBILE_QUERY).matches) {
      const r = ancre.getBoundingClientRect();
      const left = Math.max(MARGE_ECRAN, Math.min(r.right + 12, window.innerWidth - LARGEUR_PANNEAU - MARGE_ECRAN));
      const enHaut = r.top < window.innerHeight / 2;
      setPosition(
        enHaut
          ? { left, top: Math.max(MARGE_ECRAN, r.top - 6), bottom: MARGE_ECRAN }
          : { left, bottom: Math.max(MARGE_ECRAN, window.innerHeight - r.bottom - 6) }
      );
    } else {
      setPosition({ right: 20, bottom: 20 });
    }
    setPreset(nouveau);
    setCle((c) => c + 1);
    setOpen(true);
  }, []);

  /** Un vrai jet EN DIRECT (Realtime) — jamais le chargement initial de l'historique, qui ne doit ni ouvrir l'outil ni notifier. */
  const surJetEnDirect = useCallback(
    (jet: JetAffiche) => {
      if (openRef.current) return;
      if (estTelephone) {
        setToast(jet);
        setTimeout(() => setToast(null), 4500);
      } else {
        ouvrir(null);
      }
    },
    [estTelephone, ouvrir]
  );

  // V3.1-62 (docs/CABLAGE.md, docs/QUOTAS.md Q1) : l'historique ne s'affiche
  // que dans l'outil, fermé la plupart du temps. Il se charge donc à la
  // PREMIÈRE ouverture, plus à chaque page. Les jets en direct (Realtime,
  // ci-dessous) arrivent, eux, dès le montage, outil fermé compris.
  useEffect(() => {
    if (!campaignId || !open || historique?.pour === campaignId) return;
    let cancelled = false;
    fetch(`/api/campaigns/${campaignId}/dice-rolls?limit=${HISTORY_LIMIT}`)
      .then((res) => {
        if (!res.ok) throw new Error(`dice-rolls : ${res.status}`);
        return res.json() as Promise<{ rolls: DiceRollRow[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setRolls((prev) => fusionnerJets(body.rolls.map(jetDepuisLigne), prev, HISTORY_LIMIT));
        setHistorique({ pour: campaignId, etat: "charge" });
      })
      .catch((erreur: unknown) => {
        console.error("Historique des jets non charge", erreur);
        if (!cancelled) setHistorique({ pour: campaignId, etat: "erreur" });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, open, historique]);

  // Abonnement Realtime, inutile sans campagne.
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`dice_rolls:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const jet = jetDepuisLigne(payload.new as DiceRollRow);
          setRolls((prev) => [jet, ...prev].slice(0, HISTORY_LIMIT));
          surJetEnDirect(jet);
        }
      )
      // DD annoncé par le MJ : diffusion éphémère sur le même canal, jamais
      // persistée — `self: false` par défaut, le MJ ne se réenvoie pas sa valeur.
      .on("broadcast", { event: "dc" }, ({ payload }) => {
        const annonce = lireDiffusionDd(payload);
        setDd(annonce.dc);
        setDdPrive(annonce.prive);
        setDdDeMj(true);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase, surJetEnDirect]);

  useEffect(
    () => () => {
      if (minuteurDdRef.current) clearTimeout(minuteurDdRef.current);
    },
    []
  );

  /**
   * MJ seulement : chaque changement de DD est diffusé, débattu de 400 ms. DD
   * non privé : la valeur ; DD privé : `{ dc: null, private: true }`. Appelé
   * par un geste du MJ, jamais au montage (sinon chaque page écraserait le DD
   * que les joueurs viennent de recevoir).
   */
  const diffuserDd = useCallback(
    (valeur: number | null, prive: boolean) => {
      if (!isGm) return;
      if (minuteurDdRef.current) clearTimeout(minuteurDdRef.current);
      minuteurDdRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "dc",
          payload: prive ? { dc: null, private: true } : { dc: valeur, private: false },
        });
      }, 400);
    },
    [isGm]
  );

  const changerDd = useCallback(
    (valeur: number | null) => {
      setDd(valeur);
      setDdDeMj(false);
      diffuserDd(valeur, ddPrive);
    },
    [diffuserDd, ddPrive]
  );

  const changerDdPrive = useCallback(
    (prive: boolean) => {
      setDdPrive(prive);
      diffuserDd(dd, prive);
    },
    [diffuserDd, dd]
  );

  const openDiceTool = useCallback((nouveau: PreReglage) => ouvrir(nouveau), [ouvrir]);
  const rollAbility = useCallback(
    (entityId: string, ability: Ability, advantage: AdvantageState, apercu: ApercuFiche) =>
      ouvrir(preReglageDepuisFiche({ kind: "ability", entityId, ability }, advantage, apercu)),
    [ouvrir]
  );
  const rollSkill = useCallback(
    (entityId: string, skill: Skill, advantage: AdvantageState, apercu: ApercuFiche) =>
      ouvrir(preReglageDepuisFiche({ kind: "skill", entityId, skill }, advantage, apercu)),
    [ouvrir]
  );
  const rollSave = useCallback(
    (entityId: string, ability: Ability, advantage: AdvantageState, apercu: ApercuFiche) =>
      ouvrir(preReglageDepuisFiche({ kind: "save", entityId, ability }, advantage, apercu)),
    [ouvrir]
  );
  const rollInitiative = useCallback(
    (entityId: string, advantage: AdvantageState, apercu: ApercuFiche) =>
      ouvrir(preReglageDepuisFiche({ kind: "initiative", entityId }, advantage, apercu)),
    [ouvrir]
  );
  const ouvrirVolet = useCallback(() => ouvrir(null), [ouvrir]);

  const [dallesMontees, setDallesMontees] = useState<Record<PorteeDalle, number>>({ ordinateur: 0, telephone: 0 });
  const enregistrerDalle = useCallback((portee: PorteeDalle, ancre?: RefObject<HTMLElement | null>) => {
    setDallesMontees((n) => ({ ...n, [portee]: n[portee] + 1 }));
    if (portee === "ordinateur" && ancre) ancreRef.current = ancre;
    return () => {
      setDallesMontees((n) => ({ ...n, [portee]: n[portee] - 1 }));
      if (ancre && ancreRef.current === ancre) ancreRef.current = null;
    };
  }, []);
  // Un seul des deux cas masque le bouton sur sa portée ; les deux, partout.
  const classeMasqueDe =
    dallesMontees.ordinateur > 0 && dallesMontees.telephone > 0
      ? "hidden"
      : dallesMontees.ordinateur > 0
        ? "md:hidden"
        : dallesMontees.telephone > 0
          ? "max-md:hidden"
          : "";

  const contextValue = useMemo<DiceRollContextValue>(
    () => ({ isGm, openDiceTool, rollAbility, rollSkill, rollSave, rollInitiative, ouvrirVolet, enregistrerDalle }),
    [isGm, openDiceTool, rollAbility, rollSkill, rollSave, rollInitiative, ouvrirVolet, enregistrerDalle]
  );

  const fermer = useCallback(() => setOpen(false), []);
  const outil = (
    <OutilDes
      key={cle}
      preset={preset}
      campaignId={campaignId}
      isGm={isGm}
      dd={dd}
      onDd={changerDd}
      ddPrive={ddPrive}
      onDdPrive={changerDdPrive}
      ddDeMj={ddDeMj}
      jets={rolls}
      etatHistorique={etatHistorique}
      onReessayer={() => setHistorique(null)}
      onFermer={fermer}
    />
  );

  return (
    <DiceRollContext.Provider value={contextValue}>
      {children}

      {toast && (
        <button
          type="button"
          onClick={() => {
            setToast(null);
            ouvrir(null);
          }}
          className="fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-edge-strong bg-panel-raised px-3 py-2 text-left text-xs shadow-lg"
        >
          <DiceIcon className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate text-ink-soft">
            {toast.who} — {toast.what}{" "}
            <span className={`font-mech font-bold ${verdictColorClass(toast.verdict)}`}>{toast.total}</span>
          </span>
        </button>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => ouvrir(null)}
          aria-label="Ouvrir le volet de lancer de dés"
          // V3.1-27 : à partir de 768 px, le dé vit dans la dalle « Outils » du
          // rail ; V3.1-29 : sous 768 px, au centre de la barre flottante. Ce
          // bouton ne sert plus que sur une page sans rail ni barre.
          className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-edge-strong bg-panel-raised text-accent shadow-lg ${classeMasqueDe}`}
        >
          <DiceIcon className="h-7 w-7" />
        </button>
      )}

      {open &&
        (estTelephone ? (
          <FeuilleDuBas titre={t("titreFeuille")} onFermer={fermer}>
            {/* Plus haute que la feuille Outils : la zone de résultat a sa place. */}
            <div className="min-h-[min(40rem,78dvh)]">{outil}</div>
          </FeuilleDuBas>
        ) : (
          position && (
            <PanneauFlottant position={position} titre={t("titreFeuille")} onFermer={fermer}>
              {outil}
            </PanneauFlottant>
          )
        ))}
    </DiceRollContext.Provider>
  );
}

function verdictColorClass(verdict: "success" | "fail" | null): string {
  if (verdict === "success") return "text-success";
  if (verdict === "fail") return "text-danger";
  return "text-ink";
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path d="M12 2 L21 8 L21 16 L12 22 L3 16 L3 8 Z" />
      <path d="M12 2 L12 22 M3 8 L21 16 M21 8 L3 16" />
    </svg>
  );
}
