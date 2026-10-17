"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import { verdictTone, type AdvantagePair } from "@/src/core/dice/diceTool";
import { extractDiceGroups, type RollChip } from "@/src/core/dice/parseRollDetail";
import type { AdvantageState } from "@/src/core/rules/action";
import {
  ajouterDe,
  avantageEffectif,
  avantagePossible,
  bandeRelanceVisible,
  carresDuJet,
  cheminAction,
  corpsAction,
  ddDepuisSaisie,
  emplacementsAttendus,
  etatDe,
  formaterModificateur,
  pasDd,
  pasModificateur,
  peutLancer,
  reserveDepuis,
  reserveLibre,
  testARelancer,
  titreOutil,
  type JetAffiche,
  type PreReglage,
  type Reserve,
} from "@/lib/ui/outilDes";
import { messageErreur, posterJet } from "@/lib/ui/outilDesApi";
import { useMatchMedia } from "./useMatchMedia";

/**
 * L'outil de dés unique (V3.1-33, ADR 0035) : le même corps dans la feuille du
 * bas (téléphone) et dans le panneau ancré au dé du rail (ordinateur,
 * tablette). Il décrit le jet — dés, modificateur, avantage, DD, secret — et
 * affiche ce que le SERVEUR renvoie ; il ne calcule jamais un résultat
 * (règle 8). Les chiffres qui défilent pendant l'attente sont décoratifs :
 * ils ne sont jamais présentés comme un résultat.
 */

/** Réponse du serveur à un jet (`RollOutcome`, checkRolls.ts) — la partie que l'écran lit. */
export interface SortieJet {
  who: string;
  what: string;
  chips: RollChip[];
  total: number;
  dc: number | null;
  verdict: "success" | "fail" | null;
  hidden: boolean;
  trace: { text: string; value: number }[];
  pair: AdvantagePair | null;
  naturalD20: number | null;
  dcPrivate: boolean;
}

const DIE_CLIP_PATH: Record<number, string> = {
  4: "polygon(50% 4%, 96% 96%, 4% 96%)",
  6: "polygon(14% 14%, 86% 14%, 86% 86%, 14% 86%)",
  8: "polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)",
  10: "polygon(50% 2%, 92% 36%, 76% 98%, 24% 98%, 8% 36%)",
  12: "polygon(50% 2%, 95% 35%, 79% 92%, 21% 92%, 5% 35%)",
  20: "polygon(50% 2%, 95% 27%, 95% 73%, 50% 98%, 5% 73%, 5% 27%)",
  100: "polygon(50% 2%, 92% 36%, 76% 98%, 24% 98%, 8% 36%)",
};

const REDUIT_QUERY = "(prefers-reduced-motion: reduce)";
/** Délai entre deux dés qui se figent, durée du compte du total, durée du remplissage du verdict. */
const PAS_FIGE_MS = 110;
const COMPTE_MS = 450;
const REMPLISSAGE_MS = 450;
/** Attente minimale avant de figer : le scintillement doit se voir même si le serveur répond vite. */
const ATTENTE_MIN_MS = 450;
const RAFRAICHISSEMENT_BRUIT_MS = 70;

// ---- conteneur : panneau flottant (ordinateur et tablette) ------------------

export interface PositionPanneau {
  left?: number;
  right?: number;
  top?: number;
  bottom: number;
}

/**
 * Panneau ancré au dé du rail. `position: fixed` calculée à l'ouverture et
 * rendu dans un portail, comme le menu flottant du rail : aucun ancêtre
 * `overflow` ne peut le couper. Non modal : la fiche reste utilisable.
 */
export function PanneauFlottant({
  position,
  titre,
  onFermer,
  children,
}: {
  position: PositionPanneau;
  titre: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return createPortal(
    <div
      role="dialog"
      aria-label={titre}
      style={{ left: position.left, right: position.right, top: position.top, bottom: position.top === undefined ? position.bottom : undefined }}
      className="fixed z-[95] max-h-[calc(100vh-16px)] w-[344px] max-w-[calc(100vw-16px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-edge-strong bg-panel-raised p-3 shadow-2xl backdrop-blur-[var(--blur)] print:hidden"
    >
      {children}
    </div>,
    document.body
  );
}

// ---- l'outil -------------------------------------------------------------

type EtatHistorique = "sans-campagne" | "chargement" | "erreur" | "charge";

interface ContexteJet {
  /** Le DD réellement envoyé (null pour un joueur face à un DD privé). */
  dc: number | null;
  avantage: AdvantageState;
  secret: boolean;
  ddPrive: boolean;
}

interface ResultatLocal {
  jet: JetAffiche;
  contexte: ContexteJet;
  /** Ce jet est déjà une relance payée : la bande ne se propose plus. */
  relance: boolean;
}

export default function OutilDes({
  preset,
  campaignId,
  isGm,
  dd,
  onDd,
  ddPrive,
  onDdPrive,
  ddDeMj,
  jets,
  etatHistorique,
  onReessayer,
  onFermer,
}: {
  preset: PreReglage | null;
  campaignId: string | null;
  isGm: boolean;
  dd: number | null;
  onDd: (valeur: number | null) => void;
  /** MJ : l'interrupteur « DD privé ». Joueur : la valeur diffusée par le MJ (il lit « contre DD ? »). */
  ddPrive: boolean;
  onDdPrive: (valeur: boolean) => void;
  /** La valeur du DD vient d'une diffusion du MJ. */
  ddDeMj: boolean;
  jets: JetAffiche[];
  etatHistorique: EtatHistorique;
  onReessayer: () => void;
  onFermer: () => void;
}) {
  const t = useTranslations("outilDes");
  const reduit = useMatchMedia(REDUIT_QUERY);
  const idTitre = useId();

  const [actif, setActif] = useState<PreReglage | null>(preset);
  const [reserve, setReserve] = useState<Reserve>(() => (preset ? reserveDepuis(preset.dice) : reserveLibre()));
  const [modificateur, setModificateur] = useState(preset?.modifier ?? 0);
  const [avantage, setAvantage] = useState<AdvantageState>(preset?.advantage ?? "normal");
  const [secret, setSecret] = useState(preset?.secret ?? false);
  const [resultat, setResultat] = useState<ResultatLocal | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const action = actif?.action;
  const verrouille = action !== undefined;
  const avantageEff = avantageEffectif(reserve, avantage);
  const peutDonnerAvantage = avantagePossible(reserve);
  const ddCache = !isGm && ddPrive;
  const jetAffiche = enCours ? null : (resultat?.jet ?? null);

  function effacer() {
    setActif(null);
    setReserve(reserveLibre());
    setModificateur(0);
    setAvantage("normal");
    setSecret(false);
    setResultat(null);
    setErreur(null);
  }

  async function lancer(relance: boolean) {
    if (enCours) return;
    let url: string;
    let corps: object;
    let contexte: ContexteJet;
    if (relance) {
      const test = testARelancer(action);
      const base = resultat?.contexte;
      if (!action || !test || !base || base.dc === null || !campaignId) return;
      contexte = base;
      url = `/api/entities/${action.entityId}/actions/heroic-reroll`;
      corps = { campaignId, check: test, advantage: base.avantage, dc: base.dc, hidden: base.secret, dcPrivate: base.ddPrive };
    } else {
      contexte = { dc: ddCache ? null : dd, avantage: avantageEff, secret, ddPrive: isGm && ddPrive };
      if (action) {
        url = `/api/entities/${action.entityId}/actions/${cheminAction(action)}`;
        corps = {
          campaignId,
          ...corpsAction(action),
          advantage: avantageEff,
          dc: contexte.dc,
          hidden: secret,
          dcPrivate: contexte.ddPrive,
        };
      } else {
        if (!peutLancer(reserve)) return;
        // Sans campagne (accueil, V3.1-35) : le serveur lance, rien n'est enregistré.
        url = campaignId ? `/api/campaigns/${campaignId}/dice-rolls` : "/api/dice-rolls";
        corps = {
          pool: reserve,
          hidden: campaignId !== null && secret,
          modifier: modificateur,
          advantage: avantageEff,
          label: actif?.label ?? null,
          dc: contexte.dc,
          dcPrivate: contexte.ddPrive,
        };
      }
      setResultat(null);
    }

    setEnCours(true);
    setErreur(null);
    try {
      const attente = new Promise<void>((resolve) => setTimeout(resolve, reduit ? 0 : ATTENTE_MIN_MS));
      const [res] = await Promise.all([
        posterJet(url, corps),
        attente,
      ]);
      if (!res.ok) {
        const message = await messageErreur(res, relance && res.status === 409 ? t("erreurInspiration") : t("erreurJet"));
        if (relance && res.status === 409) setResultat((r) => (r ? { ...r, relance: true } : r));
        setErreur(message);
        return;
      }
      const sortie = (await res.json()) as SortieJet;
      setResultat({ jet: jetDepuisSortie(sortie), contexte, relance });
      if (relance) actif?.apresRelance?.();
    } catch (e) {
      console.error("Jet de dés non lancé", e);
      setErreur(t("erreurJet"));
    } finally {
      setEnCours(false);
    }
  }

  // ---- zone de résultat ----
  const items: ItemZone[] = jetAffiche
    ? carresDuJet(jetAffiche.groups, jetAffiche.pair).map((c) =>
        c.type === "paire"
          ? { faces: [20, 20], mode: c.mode, valeurs: [...c.rolls], retenu: c.keptIndex }
          : { faces: [c.faces], valeurs: [c.valeur] }
      )
    : emplacementsAttendus(reserve, avantageEff).map((e) => (e.type === "paire" ? { faces: [20, 20], mode: e.mode } : { faces: [e.faces] }));
  const ton = jetAffiche ? verdictTone(jetAffiche.verdict, jetAffiche.naturalD20 ?? undefined) : null;
  const revelation = useRevelation(jetAffiche, items.length, ton !== null, reduit);
  const termine = jetAffiche !== null && revelation.revele >= items.length;
  const bruitActif = !reduit && (enCours || (jetAffiche !== null && !termine));
  const bruit = useBruit(items.flatMap((i) => i.faces), bruitActif);

  const afficheBande = bandeRelanceVisible({
    verdict: termine ? (jetAffiche?.verdict ?? null) : null,
    action,
    inspiration: actif?.inspiration ?? 0,
    dejaRelance: resultat?.relance ?? false,
  });

  const titre = titreOutil(actif?.label, t("titreLibre"));
  const lancerDesactive = enCours || (!verrouille && !peutLancer(reserve));

  return (
    <div className="flex flex-col gap-3 text-ink">
      {/* En-tête : titre, Secret, fermer. */}
      <div className="flex items-center gap-2">
        <h2 id={idTitre} className="min-w-0 flex-1 truncate font-chrome text-sm font-semibold text-ink">
          {titre}
        </h2>
        {/* Le secret est un jet caché aux joueurs de la campagne : sans campagne, il n'a pas de sens. */}
        {campaignId !== null && <Interrupteur actif={secret} onChange={setSecret} libelle={t("secret")} aide={t("secretAide")} />}
        <button
          type="button"
          onClick={onFermer}
          aria-label={t("fermer")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-ink-muted transition-colors hover:text-ink"
        >
          &times;
        </button>
      </div>

      {/* Grille d4 à d100 ; le modificateur dans la case sous le d10. */}
      <div role="group" aria-label={t("des")} title={verrouille ? t("verrouille") : undefined} className="grid grid-cols-4 gap-1.5">
        {DIE_TYPES.map((type) => (
          <CaseDe
            key={type}
            type={type}
            nombre={reserve[type]}
            desactive={verrouille}
            libelle={t("ajouterDe", { de: type })}
            onClick={() => setReserve((r) => ajouterDe(r, type))}
          />
        ))}
        <div
          className={`flex h-14 items-center justify-between gap-0.5 rounded-lg border border-edge bg-panel-raised px-1 ${verrouille ? "opacity-60" : ""}`}
          role="group"
          aria-label={t("modificateur")}
        >
          <Pastille libelle={t("modificateurMoins")} desactive={verrouille} onClick={() => setModificateur((m) => pasModificateur(m, -1))}>
            ▼
          </Pastille>
          <span className="min-w-0 truncate text-center font-mech text-sm font-semibold text-ink">{formaterModificateur(modificateur)}</span>
          <Pastille libelle={t("modificateurPlus")} desactive={verrouille} onClick={() => setModificateur((m) => pasModificateur(m, 1))}>
            ▲
          </Pastille>
        </div>
      </div>

      {/* Pilule Normal / Avantage / Désavantage (pilule glissante du catalogue). */}
      <div className={peutDonnerAvantage ? "" : "opacity-40"} title={peutDonnerAvantage ? undefined : t("avantageIndisponible")}>
        <Tabs<AdvantageState>
          aria-label={t("avantageLibelle")}
          value={avantageEff}
          onChange={(valeur) => {
            if (peutDonnerAvantage) setAvantage(valeur);
          }}
          items={[
            { value: "normal", label: t("normal") },
            { value: "advantage", label: t("avantage") },
            { value: "disadvantage", label: t("desavantage") },
          ]}
        />
      </div>

      {/* DD sous la grille ; « DD privé » pour le MJ seul. */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("dd")}</span>
        {ddCache ? (
          <span className="text-sm font-semibold text-ink-soft">{t("ddPriveJoueur")}</span>
        ) : (
          <>
            <Pastille libelle={t("ddMoins")} onClick={() => onDd(pasDd(dd, -1))}>
              ▼
            </Pastille>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={dd === null ? "" : String(dd)}
              onChange={(e) => onDd(ddDepuisSaisie(e.target.value))}
              placeholder="—"
              aria-label={t("dd")}
              title={t("ddVide")}
              className="h-7 w-12 rounded-full border border-edge bg-panel-sunken px-1 text-center font-mech text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
            />
            <Pastille libelle={t("ddPlus")} onClick={() => onDd(pasDd(dd, 1))}>
              ▲
            </Pastille>
          </>
        )}
        {ddDeMj && !isGm && !ddPrive && dd !== null && <span className="text-xs text-ink-muted">{t("ddPartage")}</span>}
        {isGm && (
          <span className="ml-auto">
            <Interrupteur actif={ddPrive} onChange={onDdPrive} libelle={t("ddPrive")} />
          </span>
        )}
      </div>

      {/* Zone de résultat : permanente, hauteur fixe. */}
      <ZoneResultat
        items={items}
        jet={jetAffiche}
        revelation={revelation}
        termine={termine}
        ton={ton}
        bruit={bruit}
        bruitActif={bruitActif}
        reduit={reduit}
      />

      {/* Détails sous la zone : contre DD, verdict, chips, erreur. */}
      <div className="flex min-h-[3.25rem] flex-col gap-1 text-xs text-ink-soft" aria-live="polite">
        {termine && jetAffiche && <DetailsJet jet={jetAffiche} ton={ton} />}
        {erreur && (
          <p role="alert" className="text-danger">
            {erreur}
          </p>
        )}
      </div>

      {/* Bande du pied : sa hauteur est toujours réservée. */}
      <div className="h-9">
        {afficheBande && (
          <button
            type="button"
            onClick={() => lancer(true)}
            disabled={enCours}
            className="h-9 w-full rounded-lg border border-accent bg-panel text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-60"
          >
            {t("relancer")}
          </button>
        )}
      </div>

      {/* Cibler · Lancer · Effacer. */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled
          title={t("ciblerBientot")}
          className="rounded-lg border border-edge bg-panel-raised px-3 py-2 text-xs font-semibold text-ink-muted opacity-50"
        >
          {t("cibler")}
        </button>
        <button
          type="button"
          onClick={() => lancer(false)}
          disabled={lancerDesactive}
          className="flex-1 rounded-lg border border-accent bg-accent py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {t("lancer")}
        </button>
        <button
          type="button"
          onClick={effacer}
          className="rounded-lg border border-edge bg-panel-raised px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
        >
          {t("effacer")}
        </button>
      </div>

      {/* Derniers jets (30), avec l'ascenseur fin de globals.css. */}
      <ListeJets jets={jets} etat={etatHistorique} onReessayer={onReessayer} />
    </div>
  );
}

// ---- pièces -------------------------------------------------------------

function jetDepuisSortie(sortie: SortieJet): JetAffiche {
  return {
    id: crypto.randomUUID(),
    who: sortie.who,
    what: sortie.what,
    chips: sortie.chips,
    total: sortie.total,
    dc: sortie.dc,
    dcPrivate: sortie.dcPrivate,
    verdict: sortie.verdict,
    naturalD20: sortie.naturalD20,
    secret: sortie.hidden,
    groups: extractDiceGroups(sortie.trace),
    pair: sortie.pair,
    createdAt: new Date().toISOString(),
  };
}

function Interrupteur({
  actif,
  onChange,
  libelle,
  aide,
}: {
  actif: boolean;
  onChange: (valeur: boolean) => void;
  libelle: string;
  aide?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      title={aide}
      onClick={() => onChange(!actif)}
      className="flex shrink-0 items-center gap-1.5"
    >
      <span className={`relative h-4 w-7 rounded-full border transition-colors ${actif ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all motion-reduce:transition-none ${actif ? "left-[13px]" : "left-0.5"}`} />
      </span>
      <span className={`text-xs ${actif ? "font-semibold text-accent" : "text-ink-muted"}`}>{libelle}</span>
    </button>
  );
}

/** Pastille ▼ / ▲ de la commande (même rendu que `CommandeE`, qui ne transmet que des écarts d'une jauge). */
function Pastille({
  libelle,
  onClick,
  desactive = false,
  children,
}: {
  libelle: string;
  onClick: () => void;
  desactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={libelle}
      title={libelle}
      className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-edge bg-panel-raised text-xs leading-none text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-ink-muted"
    >
      {children}
    </button>
  );
}

function CaseDe({
  type,
  nombre,
  desactive,
  libelle,
  onClick,
}: {
  type: DieType;
  nombre: number;
  desactive: boolean;
  libelle: string;
  onClick: () => void;
}) {
  const choisi = nombre > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-label={libelle}
      className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-lg border transition-colors hover:border-accent disabled:hover:border-edge ${
        choisi ? "border-accent bg-panel" : "border-edge bg-panel-raised"
      } ${desactive && !choisi ? "opacity-40" : ""}`}
    >
      {choisi && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-bold text-panel">
          {nombre}
        </span>
      )}
      <span className={`h-4 w-4 ${choisi ? "bg-accent" : "bg-ink-muted"}`} style={{ clipPath: DIE_CLIP_PATH[Number(type.slice(1))] }} aria-hidden="true" />
      <span className={`font-mech text-xs ${choisi ? "text-ink" : "text-ink-muted"}`}>{type}</span>
    </button>
  );
}

// ---- zone de résultat ---------------------------------------------------

interface ItemZone {
  /** Les faces de chaque dé du carré (deux pour une paire), pour les chiffres décoratifs. */
  faces: number[];
  mode?: "advantage" | "disadvantage";
  /** Absent avant le jet : le carré est vide. */
  valeurs?: number[];
  retenu?: 0 | 1;
}

type Teinte = "aucune" | "plein" | "posee";
interface EtatRevelation {
  pour: string;
  revele: number;
  total: number;
  teinte: Teinte;
}
const REVELATION_VIDE: EtatRevelation = { pour: "", revele: 0, total: 0, teinte: "aucune" };

/**
 * Les dés se figent un par un, le total compte jusqu'à sa valeur, puis la
 * couleur du verdict remplit la case. Mouvement réduit : tout est là
 * immédiatement, la teinte posée sans mouvement.
 */
function useRevelation(jet: JetAffiche | null, nombre: number, aTeinte: boolean, reduit: boolean): EtatRevelation {
  const [etat, setEtat] = useState<EtatRevelation>(REVELATION_VIDE);
  const id = jet?.id ?? null;
  const total = jet?.total ?? 0;

  useEffect(() => {
    if (id === null || reduit) return;
    const minuteurs: ReturnType<typeof setTimeout>[] = [];
    let image = 0;
    const maj = (partiel: Partial<EtatRevelation>) =>
      setEtat((e) => ({ ...(e.pour === id ? e : { ...REVELATION_VIDE, pour: id }), ...partiel }));

    for (let i = 1; i <= nombre; i++) minuteurs.push(setTimeout(() => maj({ revele: i }), i * PAS_FIGE_MS));
    minuteurs.push(
      setTimeout(() => {
        const debut = performance.now();
        const pas = (maintenant: number) => {
          const p = Math.min(1, (maintenant - debut) / COMPTE_MS);
          maj({ revele: nombre, total: Math.round(total * (1 - (1 - p) ** 3)) });
          if (p < 1) {
            image = requestAnimationFrame(pas);
          } else if (aTeinte) {
            maj({ teinte: "plein" });
            minuteurs.push(setTimeout(() => maj({ teinte: "posee" }), REMPLISSAGE_MS));
          }
        };
        image = requestAnimationFrame(pas);
      }, nombre * PAS_FIGE_MS)
    );
    return () => {
      minuteurs.forEach(clearTimeout);
      cancelAnimationFrame(image);
    };
  }, [id, nombre, total, aTeinte, reduit]);

  if (!jet) return REVELATION_VIDE;
  if (reduit) return { pour: jet.id, revele: nombre, total: jet.total, teinte: aTeinte ? "posee" : "aucune" };
  return etat.pour === jet.id ? etat : REVELATION_VIDE;
}

/** Chiffres flous qui défilent (décoratifs : `Math.random` n'est jamais un résultat affiché comme tel). */
function useBruit(faces: number[], actif: boolean): number[] {
  const [bruit, setBruit] = useState<number[]>([]);
  const cle = faces.join(",");
  useEffect(() => {
    if (!actif || cle === "") return;
    const liste = cle.split(",").map(Number);
    const id = setInterval(() => setBruit(liste.map((f) => 1 + Math.floor(Math.random() * f))), RAFRAICHISSEMENT_BRUIT_MS);
    return () => clearInterval(id);
  }, [actif, cle]);
  return bruit;
}

const CLASSE_TON: Record<"success" | "fail" | "critical", string> = {
  success: "bg-success",
  fail: "bg-danger",
  critical: "bg-accent-hover",
};

function ZoneResultat({
  items,
  jet,
  revelation,
  termine,
  ton,
  bruit,
  bruitActif,
  reduit,
}: {
  items: ItemZone[];
  jet: JetAffiche | null;
  revelation: EtatRevelation;
  termine: boolean;
  ton: "success" | "fail" | "critical" | null;
  bruit: number[];
  bruitActif: boolean;
  reduit: boolean;
}) {
  const t = useTranslations("outilDes");
  const nombreDes = items.reduce((n, i) => n + i.faces.length, 0);
  const petit = nombreDes > 12;
  const debuts = items.map((_, i) => items.slice(0, i).reduce((n, it) => n + it.faces.length, 0));

  return (
    <div className="relative h-[148px] overflow-hidden rounded-xl border border-edge bg-panel-sunken" aria-label={t("zoneResultat")}>
      {/* La couleur du verdict remplit la case de gauche à droite, puis reste en teinte légère. */}
      {ton && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 origin-left ${CLASSE_TON[ton]}`}
          style={{
            transform: `scaleX(${revelation.teinte === "aucune" ? 0 : 1})`,
            opacity: revelation.teinte === "plein" ? 0.55 : revelation.teinte === "posee" ? 0.18 : 0,
            transition: reduit || revelation.teinte === "aucune" ? "none" : `transform ${REMPLISSAGE_MS}ms ease-out, opacity 600ms ease-out`,
          }}
        />
      )}
      <div className="relative flex h-full flex-col items-center justify-between px-2 py-2">
        <div className="flex min-h-0 w-full flex-1 flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 overflow-y-auto">
          {items.map((item, index) => {
            const debut = debuts[index];
            const fige = item.valeurs !== undefined && index < revelation.revele;
            return (
              <div key={index} className="flex flex-col items-center gap-1">
                {item.mode && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {item.mode === "advantage" ? t("paireAvantage") : t("paireDesavantage")}
                  </span>
                )}
                <div className="flex gap-1.5">
                  {item.faces.map((faces, j) => (
                    <Carre
                      key={j}
                      faces={faces}
                      valeur={fige ? item.valeurs?.[j] : undefined}
                      bruit={bruitActif ? bruit[debut + j] : undefined}
                      petit={petit}
                      retenu={item.retenu === undefined ? undefined : item.retenu === j}
                      libelleRetenu={t("conserve")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="font-mech text-3xl font-bold leading-none text-ink">{termine && jet ? revelation.total : "—"}</div>
        <span className="sr-only" role="status">
          {termine && jet ? t("annonceTotal", { total: jet.total }) : ""}
        </span>
      </div>
    </div>
  );
}

function Carre({
  faces,
  valeur,
  bruit,
  petit,
  retenu,
  libelleRetenu,
}: {
  faces: number;
  valeur: number | undefined;
  bruit: number | undefined;
  petit: boolean;
  /** Dans une paire : ce dé est-il celui qui compte ? Absent hors paire. */
  retenu: boolean | undefined;
  libelleRetenu: string;
}) {
  const taille = petit ? "h-7 w-7 text-xs" : "h-10 w-10 text-base";
  if (valeur === undefined) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed border-edge-strong font-mech font-semibold text-ink-muted ${taille}`}
        aria-hidden="true"
      >
        {bruit !== undefined && <span className="blur-[2px]">{bruit}</span>}
      </div>
    );
  }
  const etat = etatDe(valeur, faces);
  const couleur = etat === "maximum" ? "border-accent text-accent" : etat === "un" ? "border-danger text-danger" : "border-edge-strong text-ink";
  const paire = retenu === undefined ? "" : retenu ? "ring-2 ring-accent ring-offset-1 ring-offset-panel-sunken" : "opacity-40";
  return (
    <div
      className={`flex items-center justify-center rounded-md border bg-panel-raised font-mech font-bold ${taille} ${couleur} ${paire}`}
      title={retenu ? libelleRetenu : undefined}
    >
      {valeur}
    </div>
  );
}

function DetailsJet({ jet, ton }: { jet: JetAffiche; ton: "success" | "fail" | "critical" | null }) {
  const t = useTranslations("outilDes");
  const contre = jet.dc !== null ? t("contreDd", { dd: jet.dc }) : jet.dcPrivate ? t("contreDdInconnu") : null;
  const verdict = ton === "critical" ? t("verdictCritique") : ton === "success" ? t("verdictReussite") : ton === "fail" ? t("verdictEchec") : null;
  const couleurVerdict = ton === "fail" ? "text-danger" : ton === "success" ? "text-success" : "text-accent";
  return (
    <>
      <p className="truncate">
        <span className="text-ink">{jet.what}</span>
        {contre && <span> · {contre}</span>}
        {verdict && <span className={`font-semibold ${couleurVerdict}`}> · {verdict}</span>}
      </p>
      {jet.chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {jet.chips.map((c, i) => (
            <span key={i} className="rounded-full border border-edge bg-panel-raised px-1.5 py-0.5 font-mech text-xs">
              <span className="text-ink-muted">{c.label}</span> <span className="font-semibold text-accent">{formaterModificateur(c.value)}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ---- derniers jets ------------------------------------------------------

function ListeJets({ jets, etat, onReessayer }: { jets: JetAffiche[]; etat: EtatHistorique; onReessayer: () => void }) {
  const t = useTranslations("outilDes");
  let corps: React.ReactNode;
  if (etat === "sans-campagne") {
    corps = <p className="text-xs text-ink-muted">{t("historiqueSansCampagne")}</p>;
  } else if (jets.length === 0 && etat === "chargement") {
    corps = <p className="text-xs text-ink-muted">{t("chargement")}</p>;
  } else if (jets.length === 0 && etat === "erreur") {
    corps = (
      <p className="text-xs text-danger">
        {t("historiqueIndisponible")}{" "}
        <button type="button" onClick={onReessayer} className="underline hover:text-ink">
          {t("reessayer")}
        </button>
      </p>
    );
  } else if (jets.length === 0) {
    corps = <p className="text-xs text-ink-muted">{t("aucunJet")}</p>;
  } else {
    corps = (
      <ul className="flex max-h-36 flex-col overflow-y-auto pr-1">
        {jets.map((jet) => (
          <li key={jet.id} className="flex items-center justify-between gap-2 border-b border-edge/60 py-1 text-xs last:border-0">
            <span className="min-w-0 truncate text-ink-soft">
              {jet.who} — {jet.what}
              {jet.dc !== null && <span className="text-ink-muted"> · {t("contreDd", { dd: jet.dc })}</span>}
              {jet.dc === null && jet.dcPrivate && <span className="text-ink-muted"> · {t("contreDdInconnu")}</span>}
              {jet.secret && <span className="italic text-ink-muted"> · {t("jetSecret")}</span>}
            </span>
            <span className={`shrink-0 font-mech font-semibold ${jet.secret ? "text-ink-muted" : "text-accent"}`}>{jet.total}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="border-t border-edge pt-2">
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-muted">{t("derniersJets")}</div>
      {corps}
    </div>
  );
}
