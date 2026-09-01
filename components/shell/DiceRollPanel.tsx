"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AdvantageState } from "@/src/core/rules/action";
import type { Ability, Skill } from "@/src/core/rules/sheet";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import { extractDiceGroups, parseRollDetail, type DiceGroup, type RollChip } from "@/src/core/dice/parseRollDetail";
import type { DiceRollRow } from "@/src/server/repos/diceRolls";

/**
 * V2-M11 (Lot M) : volet de lancer de des, esthetique BG3 validee par
 * esquisse (dice-panel-mockup.html, jamais commite). Toute la logique de
 * jeu (modificateur, verdict DD, visibilite) vit deja cote serveur
 * (checkRolls.ts) — ce fichier n'affiche que ce que le serveur renvoie,
 * jamais un second calcul. Un seul flux d'alimentation pour tout le monde :
 * Realtime sur `dice_rolls` (RLS deja filtree, cf. migration
 * 20260831091000) — la reponse HTTP du clic local sert seulement a un
 * retour immediat (`lastRoll`), jamais a construire l'historique.
 */

interface DisplayRoll {
  id: string;
  who: string;
  what: string;
  chips: RollChip[];
  total: number;
  dc: number | null;
  verdict: "success" | "fail" | null;
  hidden: boolean;
  diceGroups: DiceGroup[];
  createdAt: string;
}

function rollFromRow(row: DiceRollRow): DisplayRoll {
  const detail = parseRollDetail(row.detail);
  return {
    id: row.id,
    who: detail.who ?? (row.rolled_by === "gm" ? "MJ" : "Joueur"),
    what: detail.what ?? "Jet",
    chips: detail.chips ?? [],
    total: row.result,
    dc: detail.dc ?? null,
    verdict: detail.verdict ?? null,
    hidden: row.visibility_level === "gm",
    diceGroups: extractDiceGroups(detail.trace),
    createdAt: row.created_at,
  };
}

// `RollOutcome` (checkRolls.ts) : meme forme que `dice_rolls.detail`, plus
// `trace` directement — sert au retour immediat du clic (avant meme que
// Realtime ne livre la ligne persistee), jamais une seconde source de verite
// pour l'historique (voir `rollAndDisplay` ci-dessous).
interface RollOutcomeJson {
  who: string;
  what: string;
  chips: RollChip[];
  total: number;
  dc: number | null;
  verdict: "success" | "fail" | null;
  hidden: boolean;
  trace: { text: string; value: number }[];
}

function displayRollFromOutcome(o: RollOutcomeJson): DisplayRoll {
  return {
    id: crypto.randomUUID(),
    who: o.who,
    what: o.what,
    chips: o.chips,
    total: o.total,
    dc: o.dc,
    verdict: o.verdict,
    hidden: o.hidden,
    diceGroups: extractDiceGroups(o.trace),
    createdAt: new Date().toISOString(),
  };
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

/** Cote (px) d'une forme de de pour que N formes tiennent dans le carre de 90x90 inscrit dans le cadre circulaire (meme calcul que l'esquisse validee). */
function sizeForCount(n: number): number {
  if (n <= 0) return 86;
  const box = 90;
  const gap = 4;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const sizeByCols = (box - gap * (cols - 1)) / cols;
  const sizeByRows = (box - gap * (rows - 1)) / rows;
  return Math.max(16, Math.floor(Math.min(sizeByCols, sizeByRows)));
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function DieShape({ faces, value, size }: { faces: number; value: number | string; size: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center border border-edge-strong bg-panel-raised"
      style={{ width: size, height: size, clipPath: DIE_CLIP_PATH[faces] ?? DIE_CLIP_PATH[20] }}
    >
      <span className="font-mech font-bold text-ink" style={{ fontSize: Math.max(11, size * 0.3) }}>
        {value}
      </span>
    </div>
  );
}

// ---- contexte : declenche un jet contextuel depuis n'importe quelle fiche ----

interface DiceRollContextValue {
  isGm: boolean;
  rollAbility: (entityId: string, ability: Ability, advantage: AdvantageState) => Promise<void>;
  rollSkill: (entityId: string, skill: Skill, advantage: AdvantageState) => Promise<void>;
  rollSave: (entityId: string, ability: Ability, advantage: AdvantageState) => Promise<void>;
  rollInitiative: (entityId: string, advantage: AdvantageState) => Promise<void>;
}

const DiceRollContext = createContext<DiceRollContextValue | null>(null);

/** Pour un clic sur une fiche (stat/competence/sauvegarde/initiative) — lance et alimente le volet, jamais un second affichage local. */
export function useDiceRoll(): DiceRollContextValue {
  const ctx = useContext(DiceRollContext);
  if (!ctx) throw new Error("useDiceRoll doit etre appele sous DiceRollProvider (AppShell.tsx)");
  return ctx;
}

const HISTORY_LIMIT = 50;
const MOBILE_QUERY = "(max-width: 639px)";

// `useSyncExternalStore` (pas useState+useEffect) : `window.matchMedia` est
// un etat externe au rendu React, c'est exactement ce que ce hook est fait
// pour synchroniser — evite d'appeler un setState directement dans un effet
// (react-hooks/set-state-in-effect).
function subscribeMobile(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}
function getMobileServerSnapshot(): boolean {
  return false;
}

export default function DiceRollProvider({
  campaignId,
  isGm,
  children,
}: {
  campaignId: string | null;
  isGm: boolean;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"lancer" | "historique">("lancer");
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
  const [rolls, setRolls] = useState<DisplayRoll[]>([]);
  const [lastRoll, setLastRoll] = useState<DisplayRoll | null>(null);
  const [toast, setToast] = useState<DisplayRoll | null>(null);
  const [pool, setPool] = useState<Record<DieType, number>>({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 1, d100: 0 });
  const [dc, setDc] = useState("");
  /** V2-M11 suite (retour utilisateur 31 août) : "si le MJ le souhaite, ses joueurs voient le DD" — diffuse via Realtime broadcast (ephemere, jamais persiste : c'est une annonce du moment, pas un fait de campagne). Off par defaut : taper un DD reste un calcul prive tant que le MJ n'a pas explicitement partage. */
  const [dcShared, setDcShared] = useState(false);
  /** true si la valeur actuelle de `dc` vient d'une diffusion du MJ (chez le MJ comme chez un joueur) — retombe a false des que CE client tape lui-meme dans le champ, cf. `updateDc`. */
  const [dcFromGm, setDcFromGm] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [hidden, setHidden] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingFaces, setRollingFaces] = useState<number[]>([]);
  const [freeformBusy, setFreeformBusy] = useState(false);

  // `open` change frequemment (chaque ouverture/fermeture manuelle) — une
  // ref plutot qu'une dependance evite de reabonner Realtime a chaque clic
  // sur le bouton rond, `handleLiveRoll` restant stable (`useCallback`, deps
  // `[isMobile]` seulement).
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /** Un vrai jet EN DIRECT (Realtime ou reponse HTTP immediate) — jamais le chargement initial de l'historique (`setRolls` seul, plus bas), qui ne doit ni ouvrir le volet ni notifier. */
  const handleLiveRoll = useCallback(
    (display: DisplayRoll) => {
      setLastRoll(display);
      if (isMobile) {
        if (!openRef.current) {
          setToast(display);
          setTimeout(() => setToast(null), 4500);
        }
      } else {
        setOpen(true);
      }
    },
    [isMobile]
  );

  // Chargement initial + abonnement Realtime, tous deux inutiles sans
  // campagne (monde pas encore dote d'une campagne — meme cas que `recorded: false`).
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    fetch(`/api/campaigns/${campaignId}/dice-rolls?limit=${HISTORY_LIMIT}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rolls: DiceRollRow[] } | null) => {
        if (!cancelled && body) setRolls(body.rolls.map(rollFromRow));
      })
      .catch(() => {});

    const channel = supabase
      .channel(`dice_rolls:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dice_rolls", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const display = rollFromRow(payload.new as DiceRollRow);
          setRolls((prev) => [display, ...prev].slice(0, HISTORY_LIMIT));
          handleLiveRoll(display);
        }
      )
      // DD partage par le MJ (retour utilisateur, V2-M11 suite) : diffusion
      // Realtime sur le meme canal, jamais persistee — `self: false` par
      // defaut sur ce channel, le MJ ne se reenvoie jamais sa propre valeur.
      .on("broadcast", { event: "dc" }, ({ payload }) => {
        setDc(payload.dc === null || payload.dc === undefined ? "" : String(payload.dc));
        setDcFromGm(true);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [campaignId, supabase, handleLiveRoll]);

  /** Cote MJ uniquement, quand `dcShared` est actif : chaque changement de DD (y compris le vider) est diffuse, debattu de 400ms pour ne pas spammer a chaque frappe. */
  useEffect(() => {
    if (!isGm || !dcShared) return;
    const t = setTimeout(() => {
      const value = dc.trim() === "" ? null : Number(dc);
      channelRef.current?.send({ type: "broadcast", event: "dc", payload: { dc: Number.isFinite(value) ? value : null } });
    }, 400);
    return () => clearTimeout(t);
  }, [dc, dcShared, isGm]);

  /** Le MJ tape lui-meme (pas une diffusion recue) : redevient un calcul prive tant qu'il ne repartage pas. */
  const updateDc = useCallback((v: string) => {
    setDcFromGm(false);
    setDc(v);
  }, []);

  const dcValue = dc.trim() === "" ? null : Number(dc);
  const hasDc = dc.trim() !== "" && Number.isFinite(dcValue);

  const postCheck = useCallback(
    async (path: string, entityId: string, body: object): Promise<void> => {
      const res = await fetch(`/api/entities/${entityId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const json = (await res.json()) as RollOutcomeJson;
      handleLiveRoll(displayRollFromOutcome(json));
    },
    [handleLiveRoll]
  );

  const rollAbility = useCallback(
    (entityId: string, ability: Ability, advantage: AdvantageState) =>
      postCheck("ability-check", entityId, { campaignId, ability, advantage, dc: hasDc ? dcValue : null, hidden }),
    [postCheck, campaignId, hasDc, dcValue, hidden]
  );
  const rollSkill = useCallback(
    (entityId: string, skill: Skill, advantage: AdvantageState) =>
      postCheck("skill-check", entityId, { campaignId, skill, advantage, dc: hasDc ? dcValue : null, hidden }),
    [postCheck, campaignId, hasDc, dcValue, hidden]
  );
  const rollSave = useCallback(
    (entityId: string, ability: Ability, advantage: AdvantageState) =>
      postCheck("saving-throw", entityId, { campaignId, ability, advantage, dc: hasDc ? dcValue : null, hidden }),
    [postCheck, campaignId, hasDc, dcValue, hidden]
  );
  const rollInitiative = useCallback(
    (entityId: string, advantage: AdvantageState) =>
      postCheck("initiative-check", entityId, { campaignId, advantage, dc: hasDc ? dcValue : null, hidden }),
    [postCheck, campaignId, hasDc, dcValue, hidden]
  );

  const contextValue = useMemo<DiceRollContextValue>(
    () => ({ isGm, rollAbility, rollSkill, rollSave, rollInitiative }),
    [isGm, rollAbility, rollSkill, rollSave, rollInitiative]
  );

  const poolEntries = useMemo(() => DIE_TYPES.flatMap((t) => (pool[t] > 0 ? Array(pool[t]).fill(Number(t.slice(1))) : [])), [pool]);

  async function rollFreeform() {
    if (!campaignId || poolEntries.length === 0 || freeformBusy) return;
    setFreeformBusy(true);
    setRolling(true);
    setRollingFaces(poolEntries);
    let ticks = 0;
    const spin = setInterval(() => {
      setRollingFaces(poolEntries.map((faces) => 1 + Math.floor(Math.random() * faces)));
      ticks++;
      if (ticks > 8) clearInterval(spin);
    }, 60);

    const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
    const fetchPromise = fetch(`/api/campaigns/${campaignId}/dice-rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool, hidden }),
    });
    const [res] = await Promise.all([fetchPromise, minDelay]);
    clearInterval(spin);
    setRolling(false);
    setFreeformBusy(false);
    if (!res.ok) return;
    const json = (await res.json()) as RollOutcomeJson;
    handleLiveRoll(displayRollFromOutcome(json));
  }

  function toggleDie(type: DieType) {
    setPool((prev) => ({ ...prev, [type]: prev[type] + 1 }));
  }

  function resetPool() {
    setPool({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 });
  }

  return (
    <DiceRollContext.Provider value={contextValue}>
      {children}

      {toast && (
        <button
          type="button"
          onClick={() => {
            setToast(null);
            setOpen(true);
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

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le volet de lancer de des"
        className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-edge-strong bg-panel-raised text-accent shadow-lg transition-all duration-200 ${
          open ? "pointer-events-none scale-50 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <DiceIcon className="h-7 w-7" />
      </button>

      <div
        className={`fixed bottom-5 right-5 z-[55] w-80 max-w-[calc(100vw-2rem)] origin-bottom-right overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl transition-all duration-200 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.12] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-edge px-3.5 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("lancer")}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                tab === "lancer" ? "border-edge-strong bg-panel-raised text-accent" : "border-transparent text-ink-muted"
              }`}
            >
              Lancer
            </button>
            <button
              type="button"
              onClick={() => setTab("historique")}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                tab === "historique" ? "border-edge-strong bg-panel-raised text-accent" : "border-transparent text-ink-muted"
              }`}
            >
              Historique
            </button>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1 text-lg leading-none text-ink-muted hover:text-ink">
            &times;
          </button>
        </div>

        <div className="h-[70vh] max-h-[600px] overflow-y-auto px-3.5 py-2">
          {tab === "lancer" ? (
            <LancerTab
              lastRoll={lastRoll}
              rolling={rolling}
              rollingFaces={rollingFaces}
              rolls={rolls}
              pool={pool}
              dc={dc}
              setDc={updateDc}
              dcShared={dcShared}
              setDcShared={setDcShared}
              dcFromGm={dcFromGm}
              hidden={hidden}
              setHidden={setHidden}
              isGm={isGm}
              canFreeform={campaignId !== null}
              freeformBusy={freeformBusy}
              onToggleDie={toggleDie}
              onReset={resetPool}
              onRoll={rollFreeform}
            />
          ) : (
            <HistoriqueTab rolls={rolls} hasCampaign={campaignId !== null} />
          )}
        </div>
      </div>
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

function LancerTab({
  lastRoll,
  rolling,
  rollingFaces,
  rolls,
  pool,
  dc,
  setDc,
  dcShared,
  setDcShared,
  dcFromGm,
  hidden,
  setHidden,
  isGm,
  canFreeform,
  freeformBusy,
  onToggleDie,
  onReset,
  onRoll,
}: {
  lastRoll: DisplayRoll | null;
  rolling: boolean;
  rollingFaces: number[];
  rolls: DisplayRoll[];
  pool: Record<DieType, number>;
  dc: string;
  setDc: (v: string) => void;
  /** MJ uniquement : diffuse chaque changement de DD aux joueurs (retour utilisateur, V2-M11 suite). */
  dcShared: boolean;
  setDcShared: (v: boolean) => void;
  /** La valeur actuelle de `dc` vient d'une diffusion du MJ, pas d'une frappe locale — pilote le texte d'indice ci-dessous. */
  dcFromGm: boolean;
  hidden: boolean;
  setHidden: (v: boolean) => void;
  isGm: boolean;
  canFreeform: boolean;
  freeformBusy: boolean;
  onToggleDie: (type: DieType) => void;
  onReset: () => void;
  onRoll: () => void;
}) {
  const groups = rolling ? null : lastRoll?.diceGroups.length ? lastRoll.diceGroups : null;
  const size = groups ? sizeForCount(groups.reduce((n, g) => n + g.rolls.length, 0)) : rolling ? sizeForCount(rollingFaces.length) : 86;

  return (
    <div className="flex flex-col">
      <div className="mb-1 text-center">
        <div className="text-[11px] uppercase tracking-wide text-ink-muted">{lastRoll?.who ?? "—"}</div>
        <div className="text-[15px] font-semibold text-ink">{lastRoll?.what ?? "En attente d'un jet"}</div>
      </div>

      <div className="relative mx-auto mb-1.5 flex h-36 w-36 items-center justify-center rounded-[50%/55%] border border-edge-strong bg-panel-sunken">
        <div className="flex h-[90px] w-[90px] flex-wrap items-center justify-center gap-1">
          {rolling
            ? rollingFaces.map((faces, i) => <DieShape key={i} faces={faces} value="?" size={size} />)
            : groups
              ? groups.flatMap((g, gi) => g.rolls.map((v, i) => <DieShape key={`${gi}-${i}`} faces={g.faces} value={v} size={size} />))
              : <DieShape faces={20} value="?" size={size} />}
        </div>
      </div>

      <div className="mb-1.5 min-h-[26px] text-center">
        {lastRoll && !rolling ? (
          <span className={`text-xl font-bold ${verdictColorClass(lastRoll.verdict)}`}>
            Total {lastRoll.total}
            {lastRoll.verdict && ` — ${lastRoll.verdict === "success" ? "Réussite" : "Échec"}`}
          </span>
        ) : (
          <span className="text-lg font-bold text-ink-muted">—</span>
        )}
      </div>

      {lastRoll && lastRoll.chips.length > 0 && !rolling && (
        <div className="mb-1.5 flex flex-wrap justify-center gap-1.5">
          {lastRoll.chips.map((c, i) => (
            <div key={i} className="min-w-[44px] rounded-md border border-edge bg-panel-raised px-1.5 py-1 text-center">
              <span className="block text-xs font-bold text-accent">{formatSigned(c.value)}</span>
              <span className="block text-[9px] text-ink-muted">{c.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-1 flex items-center justify-center gap-2">
        <label className="text-[11px] uppercase tracking-wide text-ink-muted" htmlFor="dice-dc-input">
          DD
        </label>
        <input
          id="dice-dc-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={dc}
          onChange={(e) => setDc(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          placeholder="—"
          className="w-16 rounded-md border border-edge bg-panel-raised px-1 py-1 text-center text-sm text-ink outline-none"
        />
        <span className="text-[10px] text-ink-muted">
          {dcFromGm && dc.trim() !== "" ? "partagé par le MJ" : "vide = pas de DD"}
        </span>
      </div>

      {/* Diffusion du DD aux joueurs (retour utilisateur, V2-M11 suite) : MJ
          uniquement, jamais visible ni actionnable pour un joueur — memes
          jetons de couleur que le reste (jamais de couleur en dur). */}
      {isGm && (
        <button type="button" onClick={() => setDcShared(!dcShared)} className="mb-1.5 flex items-center justify-center gap-1.5">
          <span className={`relative h-4 w-7 rounded-full border ${dcShared ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}>
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all ${dcShared ? "left-[13px]" : "left-0.5"}`}
            />
          </span>
          <span className={`text-[10px] ${dcShared ? "font-semibold text-accent" : "text-ink-muted"}`}>
            {dcShared ? "DD visible des joueurs" : "DD privé"}
          </span>
        </button>
      )}

      {canFreeform ? (
        <>
          <div className="mb-1.5 flex flex-wrap justify-center gap-1.5">
            {DIE_TYPES.map((type) => {
              const count = pool[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleDie(type)}
                  className={`relative flex w-[58px] flex-col items-center gap-0.5 rounded-md border px-1 py-1 ${
                    count > 0 ? "border-accent bg-panel" : "border-edge bg-panel-raised"
                  }`}
                >
                  {count > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[9px] font-bold text-panel">
                      {count}
                    </span>
                  )}
                  <div
                    className={`h-3.5 w-3.5 ${count > 0 ? "bg-accent" : "bg-ink-muted"}`}
                    style={{ clipPath: DIE_CLIP_PATH[Number(type.slice(1))] }}
                  />
                  <span className={`text-[9px] ${count > 0 ? "text-ink" : "text-ink-muted"}`}>{type}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-1.5 flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 rounded-md border border-edge bg-panel-raised py-1.5 text-xs font-semibold text-ink-soft"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onRoll}
              disabled={freeformBusy}
              className="flex-1 rounded-md border border-accent bg-accent py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60"
            >
              Lancer
            </button>
          </div>

          {isGm && (
            <button type="button" onClick={() => setHidden(!hidden)} className="mb-1.5 flex items-center justify-center gap-2">
              <span className={`relative h-[19px] w-[34px] rounded-full border ${hidden ? "border-danger bg-danger" : "border-edge-strong bg-edge"}`}>
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink transition-all ${hidden ? "left-[17px]" : "left-0.5"}`}
                />
              </span>
              <span className={`text-xs ${hidden ? "font-semibold text-danger" : "text-ink-muted"}`}>
                {hidden ? "Lancé secret" : "Lancé public"}
              </span>
            </button>
          )}
        </>
      ) : (
        <p className="mb-1.5 text-center text-xs text-ink-muted">Ce monde n&apos;a pas encore de campagne — jet non enregistré.</p>
      )}

      <div className="border-t border-edge pt-1">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-muted">4 derniers jets</div>
        <div className="flex flex-col">
          {rolls.slice(0, 4).map((r) => (
            <div key={r.id} className="flex justify-between border-b border-edge/60 py-0.5 text-xs last:border-0">
              <span className="truncate text-ink-muted">
                {r.who} — {r.what}
              </span>
              {/* `hidden` : la RLS ne livre jamais cette ligne a un client autre que le MJ (migration 20260831091000) — masquer la valeur ici serait cacher au MJ ce qu'il a lui-meme le droit de voir, jamais une seconde barriere utile. */}
              <span className={`whitespace-nowrap font-semibold ${r.hidden ? "text-ink-muted" : "text-accent"}`}>{r.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoriqueTab({ rolls, hasCampaign }: { rolls: DisplayRoll[]; hasCampaign: boolean }) {
  if (!hasCampaign) return <p className="text-center text-xs text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;
  if (rolls.length === 0) return <p className="text-center text-xs text-ink-muted">Aucun jet pour le moment.</p>;
  return (
    <div className="flex flex-col">
      {rolls.map((r) => (
        <div key={r.id} className="flex items-center justify-between border-b border-edge/60 py-2 last:border-0">
          <div className="flex flex-col">
            <span className={`text-xs ${r.hidden ? "italic text-ink-muted" : "text-ink"}`}>
              {r.hidden ? `Jet caché — ${r.who}` : `${r.who} — ${r.what}`}
            </span>
            <span className="text-[10px] text-ink-muted">
              {r.dc !== null && `DD ${r.dc} · ${r.verdict === "success" ? "réussite" : "échec"} · `}
              {new Date(r.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <span className={`text-sm font-bold ${r.hidden ? "text-ink-muted" : "text-accent"}`}>{r.total}</span>
        </div>
      ))}
    </div>
  );
}
