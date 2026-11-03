"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { rafraichirFriseAction, setTimelineEntryScopeAction } from "@/app/m/[worldSlug]/(monde)/chronologie/actions";
import Dropdown from "@/components/shared/Dropdown";
import FriseCarte, { POINT_PAR_TEINTE, TIGE } from "@/components/shell/frise/FriseCarte";
import FriseEres from "@/components/shell/frise/FriseEres";
import FriseEvenementForm from "@/components/shell/frise/FriseEvenementForm";
import { teinteGenre } from "@/lib/ui/axeBande";
import {
  centreApresGlisser,
  fichesAvecChronologie,
  fichesDuFlux,
  FILTRES_VIERGES,
  filtrerEntrees,
  type FiltresFrise,
  facteurPincement,
  gesteMolette,
  peutFaireFiche,
  pointsDeFrise,
  SEUIL_GLISSER,
  teinteEre,
  vueInitiale,
  vueSurPlage,
} from "@/lib/ui/frise";
import { changerVisibiliteEntree, promouvoirEntree } from "@/lib/ui/friseApi";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { yearPosition } from "@/src/core/calendar/axisPosition";
import type { GameDate } from "@/src/core/calendar/types";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { TIMELINE_ENTRY_KINDS, type TimelineEntryKind } from "@/src/core/schemas/blocks/timeline";
import {
  centerOnToday,
  eraBands,
  graduationTicks,
  layoutCards,
  presetView,
  scrollView,
  stepView,
  summarizeView,
  viewRange,
  worldExtent,
  xOfYear,
  yearOfX,
  zoomAround,
  zoomFactor,
  type View,
  type ViewPreset,
  type WorldExtent,
} from "@/src/core/timeline/view";
import type { WorldTimelineEntry } from "@/src/server/services/timeline";

/** Hauteur de la scène de la frise, en px : l'axe au milieu, les cartes dessus et dessous. */
const HAUTEUR = 440;
const LARGEUR_DEPART = 960;
const PRESETS: ViewPreset[] = ["world", "era", "century", "life"];

const BOUTON = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

function cleDe(e: WorldTimelineEntry): string {
  return `${e.sourceEntityId}:${e.entry.id}`;
}

function borner(centre: number, monde: WorldExtent): number {
  return Math.max(monde.start, Math.min(centre, monde.end));
}

/**
 * La frise horizontale de la Chronologie (V3.1-98). Le serveur a déjà filtré
 * le flux pour ce lecteur (et pour « Voir comme les joueurs ») ; tout le
 * calcul de la vue est dans `src/core/timeline/view.ts`, la présentation pure
 * dans `lib/ui/frise.ts`. Ici : le dessin, les gestes et les panneaux.
 */
export default function WorldTimelineView({
  worldSlug,
  entries,
  calendar,
  estMj,
  vueJoueurs,
}: {
  worldSlug: string;
  entries: WorldTimelineEntry[];
  calendar: CalendarConfigInput;
  estMj: boolean;
  vueJoueurs: boolean;
}) {
  const t = useTranslations("frise");
  const tg = useTranslations("fiche.chronologie.genres");

  // Le calendrier du flux, sauf les ères que le panneau « Ères… » vient d'enregistrer.
  const [calendrier, setCalendrier] = useState(calendar);
  const todayYear = calendrier.currentDate ? yearPosition(calendrier.currentDate, calendrier) : null;
  const voitPastilles = estMj && !vueJoueurs;

  const [filtres, setFiltres] = useState<FiltresFrise>(FILTRES_VIERGES);
  const filtrees = useMemo(() => filtrerEntrees(entries, filtres), [entries, filtres]);
  const points = useMemo(() => pointsDeFrise(filtrees, calendrier), [filtrees, calendrier]);
  // L'étendue du monde ne bouge pas avec les filtres : on ne perd pas sa place en cherchant.
  const monde = useMemo(
    () => worldExtent(pointsDeFrise(entries, calendrier).map((p) => p.year), calendrier.eras, todayYear),
    [entries, calendrier, todayYear]
  );

  const [vue, setVue] = useState<View>(() => vueInitiale(monde, todayYear));
  const [largeur, setLargeur] = useState(LARGEUR_DEPART);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [eresOuvert, setEresOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [promotion, setPromotion] = useState(false);

  const scene = useRef<HTMLDivElement>(null);

  // La largeur de la scène, suivie à chaque redimensionnement.
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    const mesurer = () => setLargeur(Math.max(el.clientWidth, 1));
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Molette : écouteur NON passif, pour que la page ne défile pas pendant que le pointeur est sur la frise.
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    const surMolette = (evt: WheelEvent) => {
      evt.preventDefault();
      const geste = gesteMolette(evt);
      if (!geste) return;
      if (geste.type === "defiler") {
        setVue((v) => scrollView(v, geste.sens, monde));
        return;
      }
      const x = evt.clientX - el.getBoundingClientRect().left;
      setVue((v) => zoomAround(v, zoomFactor(geste.sens, "wheel"), yearOfX(x, v, largeur), monde));
    };
    el.addEventListener("wheel", surMolette, { passive: false });
    return () => el.removeEventListener("wheel", surMolette);
  }, [monde, largeur]);

  /* Glisser (un doigt ou la souris) et pincer (deux doigts). */
  const pointeurs = useRef(new Map<number, { x: number; y: number }>());
  const glisse = useRef<{ x: number; centre: number; actif: boolean } | null>(null);
  const pince = useRef<{ distance: number; vue: View; ancre: number } | null>(null);

  function distanceDeuxDoigts(): { distance: number; milieu: number } | null {
    const [a, b] = [...pointeurs.current.values()];
    if (!a || !b) return null;
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), milieu: (a.x + b.x) / 2 };
  }

  function appui(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-sans-glisser]")) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.current.size === 2) {
      const d = distanceDeuxDoigts();
      if (d) {
        const gauche = e.currentTarget.getBoundingClientRect().left;
        pince.current = { distance: d.distance, vue, ancre: yearOfX(d.milieu - gauche, vue, largeur) };
      }
      glisse.current = null;
    } else {
      glisse.current = { x: e.clientX, centre: vue.center, actif: false };
    }
  }

  function mouvement(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pince.current) {
      const d = distanceDeuxDoigts();
      const facteur = d ? facteurPincement(pince.current.distance, d.distance) : null;
      if (facteur !== null) setVue(zoomAround(pince.current.vue, facteur, pince.current.ancre, monde));
      return;
    }
    const g = glisse.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    if (!g.actif) {
      if (Math.abs(dx) < SEUIL_GLISSER) return;
      g.actif = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setVue((v) => ({ ...v, center: borner(centreApresGlisser(g.centre, dx, v.span, largeur), monde) }));
  }

  function levee(e: React.PointerEvent<HTMLDivElement>) {
    pointeurs.current.delete(e.pointerId);
    pince.current = null;
    if (pointeurs.current.size === 0) glisse.current = null;
  }

  /* Boutons de la barre. */
  const resume = summarizeView(points, vue);
  const plage = viewRange(vue);
  const disposition = useMemo(() => layoutCards(points, vue, largeur), [points, vue, largeur]);
  const bandes = useMemo(() => eraBands(calendrier.eras, vue, largeur, todayYear ?? monde.end), [calendrier.eras, vue, largeur, todayYear, monde.end]);
  const graduations = useMemo(() => graduationTicks(vue), [vue]);
  const xAujourdhui = todayYear !== null && todayYear >= plage.start && todayYear <= plage.end ? xOfYear(todayYear, vue, largeur) : null;
  const ficheParCle = (cle: string) => entries.find((e) => cleDe(e) === cle) ?? null;
  const selection = choisie ? ficheParCle(choisie) : null;

  async function apresEcriture(res: Awaited<ReturnType<typeof promouvoirEntree>>, erreur: string): Promise<boolean> {
    if (res.ok) {
      setMessage(null);
      await rafraichirFriseAction({ worldSlug });
      return true;
    }
    if (res.conflit) {
      setMessage(t("detail.conflit"));
      await rafraichirFriseAction({ worldSlug });
    } else {
      setMessage(res.message ?? erreur);
    }
    return false;
  }

  async function changerPortee(item: WorldTimelineEntry, scope: WorldTimelineEntry["scope"]) {
    if (!item.block) return;
    const res = await setTimelineEntryScopeAction({
      worldSlug,
      blockId: item.block.id,
      entryId: item.entry.id,
      scope,
      expectedVersion: item.block.version,
    });
    if (res.ok) {
      setMessage(null);
      return;
    }
    // Le serveur répond par un texte ; un conflit de version demande de relire la frise.
    setMessage(res.error);
    await rafraichirFriseAction({ worldSlug });
  }

  async function changerVisibilite(item: WorldTimelineEntry, niveau: string): Promise<boolean> {
    if (!item.block) return false;
    const res = await changerVisibiliteEntree({ entityId: item.sourceEntityId, blockId: item.block.id, entryId: item.entry.id, niveau });
    return apresEcriture(res, t("detail.erreurVisibilite"));
  }

  async function faireFiche(item: WorldTimelineEntry) {
    if (!item.block) return;
    setPromotion(true);
    const res = await promouvoirEntree({ blockId: item.block.id, version: item.block.version, entryId: item.entry.id });
    setPromotion(false);
    await apresEcriture(res, t("detail.erreurFiche"));
  }

  const dateDepart: GameDate = calendrier.currentDate ?? { year: 0, month: 1, day: 1, precision: "day", end: null, label: null };
  const fiches = fichesDuFlux(entries);
  const genreOptions = [{ value: "", label: t("barre.tousGenres") }, ...TIMELINE_ENTRY_KINDS.map((k) => ({ value: k, label: tg(k) }))];
  const ficheOptions = [{ value: "", label: t("barre.toutesFiches") }, ...fiches.map((f) => ({ value: f.id, label: f.nom }))];
  const detailVue = t(`barre.detail.${resume.level}`);

  return (
    <div className="@container relative flex min-h-0 flex-1 gap-0">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ink">{t("titre")}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {estMj && (
              <Link href={vueJoueurs ? `/m/${worldSlug}/chronologie` : `/m/${worldSlug}/chronologie?vue=joueurs`} className={BOUTON}>
                {vueJoueurs ? t("barre.voirMj") : t("barre.voirJoueurs")}
              </Link>
            )}
            {estMj && (
              <button type="button" onClick={() => setEresOuvert((o) => !o)} aria-expanded={eresOuvert} className={BOUTON}>
                {t("barre.eres")}
              </button>
            )}
            {estMj && !vueJoueurs && (
              <button
                type="button"
                onClick={() => setFormOuvert((o) => !o)}
                aria-expanded={formOuvert}
                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                {t("barre.evenement")}
              </button>
            )}
          </div>
        </div>

        {vueJoueurs && <p className="rounded-md border border-players/50 px-3 py-2 text-sm text-players">{t("vueJoueurs")}</p>}

        {formOuvert && estMj && !vueJoueurs && (
          <FriseEvenementForm
            worldSlug={worldSlug}
            calendrier={calendrier}
            fiches={fichesAvecChronologie(entries)}
            dateDepart={dateDepart}
            onFermer={() => setFormOuvert(false)}
          />
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-ink" aria-live="polite">
            {t("barre.vue", { etendue: Math.round(vue.span), detail: detailVue })}
            {resume.hiddenCount > 0 && <span className="text-ink-muted"> · {t("barre.cachees", { n: resume.hiddenCount })}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setVue((v) => zoomAround(v, zoomFactor("out", "button"), v.center, monde))} aria-label={t("barre.moins")} className={BOUTON}>
              −
            </button>
            <button type="button" onClick={() => setVue((v) => zoomAround(v, zoomFactor("in", "button"), v.center, monde))} aria-label={t("barre.plus")} className={BOUTON}>
              +
            </button>
            <div role="group" aria-label={t("barre.presets")} className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setVue((v) => presetView(p, v, monde))} className={BOUTON}>
                  {t(`barre.preset.${p}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={todayYear === null}
              title={todayYear === null ? t("barre.centrerSans") : undefined}
              onClick={() => todayYear !== null && setVue((v) => centerOnToday(v, todayYear, monde))}
              className={BOUTON}
            >
              {t("barre.centrer")}
            </button>
            <button type="button" onClick={() => setVue((v) => stepView(v, -1, monde))} aria-label={t("barre.precedent")} className={BOUTON}>
              ‹
            </button>
            <button type="button" onClick={() => setVue((v) => stepView(v, 1, monde))} aria-label={t("barre.suivant")} className={BOUTON}>
              ›
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            value={filtres.genre ?? ""}
            options={genreOptions}
            onChange={(v) => setFiltres((f) => ({ ...f, genre: v === "" ? null : (v as TimelineEntryKind) }))}
            aria-label={t("barre.filtreGenre")}
          />
          <Dropdown
            value={filtres.fiche ?? ""}
            options={ficheOptions}
            onChange={(v) => setFiltres((f) => ({ ...f, fiche: v === "" ? null : v }))}
            aria-label={t("barre.filtreFiche")}
          />
          <input
            type="search"
            value={filtres.recherche}
            onChange={(e) => setFiltres((f) => ({ ...f, recherche: e.target.value }))}
            placeholder={t("barre.recherche")}
            aria-label={t("barre.rechercheLabel")}
            className="min-w-[10rem] rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          />
        </div>

        {message && (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}

        <div
          ref={scene}
          role="group"
          aria-label={t("frise")}
          onPointerDown={appui}
          onPointerMove={mouvement}
          onPointerUp={levee}
          onPointerCancel={levee}
          style={{ height: HAUTEUR }}
          className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-edge bg-panel-sunken"
        >
          {entries.length === 0 && <p className="absolute inset-x-0 top-4 text-center text-sm text-ink-muted">{t("aucunMonde")}</p>}
          {entries.length > 0 && filtrees.length === 0 && <p className="absolute inset-x-0 top-4 text-center text-sm text-ink-muted">{t("aucun")}</p>}

          {/* L'axe, les ères en bandeaux et les graduations. */}
          <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-edge-strong" style={{ top: HAUTEUR / 2 - 1 }} />
          {bandes.map((b, i) => (
            <div
              key={`${b.name}-${i}`}
              className={`pointer-events-none absolute flex items-center overflow-hidden border-l border-edge-strong px-1.5 text-xs text-ink-muted ${teinteEre(i)}`}
              style={{ left: b.x0, width: Math.max(b.x1 - b.x0, 0), top: HAUTEUR / 2 - 13, height: 26 }}
            >
              <span className="truncate">{b.name}</span>
            </div>
          ))}
          {graduations.map((a) => (
            <div key={a} className="pointer-events-none absolute" style={{ left: xOfYear(a, vue, largeur), top: HAUTEUR / 2 + 13 }}>
              <div className="h-1.5 w-px bg-edge-strong" />
              <span className="-ml-4 inline-block w-8 text-center font-mono text-xs text-ink-muted">{a}</span>
            </div>
          ))}

          {/* Aujourd'hui : le trait doré. */}
          {xAujourdhui !== null && (
            <div className="pointer-events-none absolute bottom-3 top-3 z-[5] w-0.5 bg-accent shadow-[0_0_8px_var(--accent)]" style={{ left: xAujourdhui - 1 }}>
              <span className="absolute left-1.5 top-0 whitespace-nowrap text-xs text-accent">{t("aujourdhui")}</span>
            </div>
          )}

          {/* Les cartes, leur tige et leur point. */}
          {disposition.cards.map((c) => {
            const item = filtrees[Number(c.id)];
            if (!item) return null;
            const petit = item.scope === "detail";
            return (
              <div key={c.id}>
                <div
                  className="pointer-events-none absolute z-[6] w-px bg-edge-strong"
                  style={{ left: c.x, height: TIGE, ...(c.side === "above" ? { bottom: HAUTEUR / 2 } : { top: HAUTEUR / 2 }) }}
                />
                <div
                  className={`pointer-events-none absolute z-[7] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel-sunken ${petit ? "h-2 w-2" : "h-3.5 w-3.5"} ${POINT_PAR_TEINTE[teinteGenre(item.entry.kind)]}`}
                  style={{ left: c.x, top: HAUTEUR / 2 }}
                />
                <FriseCarte
                  item={item}
                  calendrier={calendrier}
                  worldSlug={worldSlug}
                  x={c.x}
                  cote={c.side}
                  hauteurStade={HAUTEUR}
                  choisie={choisie === cleDe(item)}
                  estMj={voitPastilles}
                  plusAutour={c.more.count}
                  onChoisir={() => setChoisie((cle) => (cle === cleDe(item) ? null : cleDe(item)))}
                  onPortee={(s) => void changerPortee(item, s)}
                  onVisibilite={(n) => changerVisibilite(item, n)}
                  onZoomerAutour={() => c.more.range && setVue(vueSurPlage(c.more.range, monde))}
                />
              </div>
            );
          })}
        </div>

        {selection && (
          <section aria-label={t("detail.titre")} className="flex flex-col gap-2 rounded-lg border border-edge bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-wider text-ink-muted">{tg(selection.entry.kind)}</span>
                <h2 className="text-sm font-semibold text-ink">{selection.entry.title}</h2>
                <span className="font-mono text-xs text-ink-muted">{formatGameDate(selection.entry.date, calendrier)}</span>
              </div>
              <button type="button" onClick={() => setChoisie(null)} className={BOUTON}>
                {t("detail.fermer")}
              </button>
            </div>
            <p className={`text-sm ${selection.entry.summary ? "text-ink-soft" : "italic text-ink-muted"}`}>{selection.entry.summary || t("detail.sansResume")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {selection.refEntitySlug && (
                <a href={`/m/${worldSlug}/f/${selection.refEntitySlug}`} className="text-sm text-link-entity hover:underline">
                  {t("detail.voirFiche")}
                </a>
              )}
              {voitPastilles && peutFaireFiche(selection) && (
                <button type="button" onClick={() => void faireFiche(selection)} disabled={promotion} className={BOUTON}>
                  {promotion ? t("detail.faireFicheEnCours") : t("detail.faireFiche")}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {eresOuvert && estMj && (
        <FriseEres
          worldSlug={worldSlug}
          calendrier={calendrier}
          todayYear={todayYear}
          onEnregistre={setCalendrier}
          onFermer={() => setEresOuvert(false)}
        />
      )}
    </div>
  );
}
