"use client";

import { useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import EyeIcon from "@/components/shared/EyeIcon";
import GameDateInput from "@/components/shared/GameDateInput";
import Checkbox from "@/components/shared/Checkbox";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { useWorldCalendar } from "@/components/shared/useWorldCalendar";
import type { GameDate } from "@/src/core/calendar/types";
import { PERSONALITY_POLE_KEYS, WORLDVIEW_POLE_KEYS } from "@/src/core/psyche/keys";
import { PERSONALITY_POLES_FR, WORLDVIEW_POLES_FR, type PoleDisplayFr } from "@/src/i18n/fr";
import {
  appliquesParEvenement,
  avancerAjout,
  ecartApresPas,
  type EtatAjout,
} from "@/lib/ui/psycheBloc";

const BLANK_DATE: GameDate = { year: 0, month: null, day: null, precision: "year", end: null, label: null };

/** La liste côté serveur ne rend que les 20 derniers souvenirs (`listPersonalityEvents`). */
const TAILLE_PAGE = 20;

/** Ce que le parent peut demander à la liste. */
export interface SouvenirsPsycheHandle {
  recharger: () => void;
}

interface SouvenirInfo {
  id: string;
  summary: string;
  deltas: Partial<Record<string, number>>;
  occurred_at_ingame: GameDate | null;
  created_at: string;
  is_public: boolean;
}

interface Genre {
  keys: readonly string[];
  table: Record<string, PoleDisplayFr>;
  lister: (entityId: string) => string;
  ecrire: (blockId: string) => string;
}

/** Personnalité et Convictions partagent le même journal ; seules les routes et les pôles changent. */
const GENRES: Record<"personality" | "worldview", Genre> = {
  personality: {
    keys: PERSONALITY_POLE_KEYS,
    table: PERSONALITY_POLES_FR,
    lister: (id) => `/api/entities/${id}/personality-events`,
    ecrire: (id) => `/api/blocks/${id}/personality-event`,
  },
  worldview: {
    keys: WORLDVIEW_POLE_KEYS,
    table: WORLDVIEW_POLES_FR,
    lister: (id) => `/api/entities/${id}/worldview-events`,
    ecrire: (id) => `/api/blocks/${id}/worldview-event`,
  },
};

function signe(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

/**
 * V3.1-70 — les souvenirs d'un bloc Personnalité ou Convictions : repliables
 * (la liste n'est demandée qu'à la première ouverture), une saisie en une
 * ligne (ce qui s'est passé, le pôle touché en pastilles, l'écart par pas de
 * 10, « Ajouter »), et chaque ligne dit le BRUT et l'APPLIQUÉ
 * (« Prudence +20 (appliqué +14) »). Un écart de plus de 40 demande
 * confirmation ; refuser n'écrit rien (`avancerAjout`, testé).
 */
export default function SouvenirsPsyche({
  genre,
  entityId,
  blockId,
  version,
  worldSlug,
  valeursActuelles,
  onBlockRefreshed,
  ref,
}: {
  genre: "personality" | "worldview";
  entityId: string;
  blockId: string;
  version: number;
  worldSlug: string;
  /** Les valeurs courantes des pôles, pour vérifier que le rejeu du journal retombe dessus. */
  valeursActuelles: Partial<Record<string, number>>;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Le parent appelle `recharger()` après une barre réglée à la main (même journal) : la liste se relit si elle est ouverte, sinon à sa prochaine ouverture. */
  ref?: React.Ref<SouvenirsPsycheHandle>;
}) {
  const t = useTranslations("fiche.psyche.souvenirs");
  const config = GENRES[genre];
  const calendrier = useWorldCalendar(worldSlug);
  const [ouvert, setOuvert] = useState(false);
  const [souvenirs, setSouvenirs] = useState<SouvenirInfo[] | null>(null);
  const [resume, setResume] = useState("");
  const [axe, setAxe] = useState<string>(config.keys[0]);
  const [ecart, setEcart] = useState(10);
  const [avecDate, setAvecDate] = useState(false);
  const [dateEnJeu, setDateEnJeu] = useState<GameDate>(BLANK_DATE);
  const [ajout, setAjout] = useState<EtatAjout>({ etape: "saisie" });
  const [erreur, setErreur] = useState<string | null>(null);
  const occupeRef = useRef(false);

  async function charger() {
    const res = await fetch(config.lister(entityId));
    if (!res.ok) {
      setErreur(t("erreurChargement"));
      return;
    }
    setSouvenirs((await res.json()) as SouvenirInfo[]);
  }

  function basculer() {
    const suivant = !ouvert;
    setOuvert(suivant);
    if (suivant && souvenirs === null) void charger();
  }

  useImperativeHandle(ref, () => ({
    recharger() {
      if (ouvert) void charger();
      else setSouvenirs(null);
    },
  }));

  async function basculerPublic(souvenir: SouvenirInfo) {
    const suivant = !souvenir.is_public;
    setSouvenirs((prev) => (prev ?? []).map((s) => (s.id === souvenir.id ? { ...s, is_public: suivant } : s)));
    const res = await fetch(`/api/personality-events/${souvenir.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: suivant }),
    });
    if (!res.ok) {
      setSouvenirs((prev) => (prev ?? []).map((s) => (s.id === souvenir.id ? { ...s, is_public: !suivant } : s)));
      setErreur(t("erreurVisibilite"));
    }
  }

  async function ecrire(delta: number) {
    if (occupeRef.current) return;
    occupeRef.current = true;
    setErreur(null);
    try {
      const res = await fetch(config.ecrire(blockId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          summary: resume.trim(),
          deltas: { [axe]: delta },
          occurredAtIngame: avecDate ? dateEnJeu : null,
        }),
      });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        setErreur(corps?.error ?? t("erreurAjout"));
        return;
      }
      const corps = (await res.json()) as { block: { id: string; data: unknown; version: number } };
      onBlockRefreshed(corps.block);
      setResume("");
      setAvecDate(false);
      setDateEnJeu(BLANK_DATE);
      setEcart(10);
      await charger();
    } finally {
      occupeRef.current = false;
    }
  }

  function agir(evenement: Parameters<typeof avancerAjout>[1]) {
    const suite = avancerAjout(ajout, evenement);
    setAjout(suite.etat);
    if (suite.ecrire !== null) void ecrire(suite.ecrire);
  }

  function ajouter() {
    if (resume.trim() === "") {
      setErreur(t("erreurResume"));
      return;
    }
    setErreur(null);
    agir({ type: "ajouter", delta: ecart });
  }

  const liste = souvenirs ?? [];
  const appliques = appliquesParEvenement(liste, valeursActuelles, liste.length < TAILLE_PAGE);

  return (
    <div className="rounded-xl border border-edge">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={basculer}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-ink"
      >
        <span className="flex-1">{t("titre")}</span>
        {souvenirs !== null && <span className="text-xs font-normal text-ink-muted">{souvenirs.length}</span>}
        <span aria-hidden className="text-ink-muted">
          {ouvert ? "▴" : "▾"}
        </span>
      </button>
      {ouvert && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {souvenirs !== null && liste.length === 0 && <p className="text-xs italic text-ink-muted">{t("aucun")}</p>}
          {liste.map((s) => (
            <div key={s.id} className="grid grid-cols-[1.25rem_auto_1fr] items-baseline gap-x-2 gap-y-0.5 border-t border-edge pt-1.5 text-xs @lg/bloc:grid-cols-[1.25rem_6rem_1fr_auto]">
              <button
                type="button"
                onClick={() => void basculerPublic(s)}
                className="self-center text-ink-muted hover:text-ink"
                aria-label={s.is_public ? t("wikiMasquer") : t("wikiAfficher")}
                title={s.is_public ? t("wikiVisible") : t("wikiMasque")}
              >
                <EyeIcon open={s.is_public} className="h-3.5 w-3.5" />
              </button>
              <span className="whitespace-nowrap tabular-nums text-ink-muted">
                {s.occurred_at_ingame
                  ? formatGameDate(s.occurred_at_ingame, calendrier)
                  : new Date(s.created_at).toLocaleDateString("fr-FR")}
              </span>
              <span className="text-ink">{s.summary}</span>
              <span className="col-start-3 text-accent @lg/bloc:col-start-auto">
                {Object.entries(s.deltas).map(([cle, brut]) => {
                  if (brut === undefined) return null;
                  const pole = config.table[cle];
                  const applique = appliques[s.id]?.[cle];
                  return (
                    <span key={cle} className="mr-2 whitespace-nowrap">
                      {t("brut", { pole: pole ? pole.radar : cle, delta: signe(brut) })}
                      {applique !== undefined && applique !== brut && (
                        <small className="ml-1 text-ink-muted">{t("applique", { delta: signe(applique) })}</small>
                      )}
                    </span>
                  );
                })}
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-2">
            <input
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder={t("textePlaceholder")}
              aria-label={t("texteLabel")}
              className="min-w-48 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
            />
            <div role="group" aria-label={t("axe")} className="flex flex-wrap gap-1">
              {config.keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={axe === k}
                  onClick={() => setAxe(k)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    axe === k ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised hover:text-ink"
                  }`}
                >
                  {config.table[k].radar}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center rounded-full border border-edge bg-panel-sunken text-xs tabular-nums">
              <button type="button" aria-label={t("moins")} onClick={() => setEcart(ecartApresPas(ecart, -1))} className="px-2 py-0.5 text-ink-muted hover:text-accent">
                −
              </button>
              <b className="min-w-9 text-center font-medium" aria-label={t("ecart")}>
                {signe(ecart)}
              </b>
              <button type="button" aria-label={t("plus")} onClick={() => setEcart(ecartApresPas(ecart, 1))} className="px-2 py-0.5 text-ink-muted hover:text-accent">
                +
              </button>
            </span>
            <button
              type="button"
              onClick={ajouter}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              {t("ajouter")}
            </button>
          </div>
          <Checkbox checked={avecDate} onChange={() => setAvecDate(!avecDate)} label={t("dateEnJeu")} className="text-xs text-ink-muted" />
          {avecDate && <GameDateInput calendar={calendrier} value={dateEnJeu} onChange={setDateEnJeu} />}
          {ajout.etape === "confirmation" && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-gm/50 bg-gm/10 px-2.5 py-1.5 text-xs text-gm">
              <span className="flex-1">{t("confirmer")}</span>
              <button type="button" onClick={() => agir({ type: "annuler" })} className="rounded-full border border-edge px-3 py-0.5 text-ink transition-colors hover:bg-panel-raised">
                {t("annuler")}
              </button>
              <button type="button" onClick={() => agir({ type: "confirmer" })} className="rounded-full bg-accent px-3 py-0.5 font-medium text-accent-ink transition-colors hover:bg-accent-hover">
                {t("confirmerBouton")}
              </button>
            </div>
          )}
          {erreur && <p className="text-xs text-danger">{erreur}</p>}
        </div>
      )}
    </div>
  );
}
