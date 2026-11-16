"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  VUE_DEPART,
  apercuZone,
  arrondiPose,
  contourZone,
  deplacerVue,
  distanceAffichee,
  echelleBarre,
  ecranVersMetres,
  etapesZone,
  initiales,
  metresVersEcran,
  pixelsParMetre,
  positionAffichee,
  repartir,
  resumeMouvement,
  vueQuiCadre,
  zoomerAutour,
  type Cadre,
  type EtapeZone,
  type JetonPlan,
  type MouvementRecu,
  type Point,
  type Surcharge,
  type VuePlan,
  type ZoneAPoser,
} from "@/lib/ui/planCombat";

/**
 * V3.1-170 (ADR 0077) — le plan du combat : une surface sans grille où les
 * jetons se posent, en mètres. Se déplace et se zoome au doigt (deux doigts) et
 * à la souris (molette) ; un jeton se déplace en le glissant et se pose là où
 * le doigt se lève. Un déplacement = UNE requête, au lâcher (docs/QUOTAS.md).
 *
 * Le composant ne charge rien : les jetons viennent de l'écran qui l'accueille
 * (docs/CABLAGE.md, C1). Le déplacement part par `onDeplacer`, qui lève une
 * erreur au refus ; le jeton revient alors où il était, avec le message de la route.
 */

/** Cible de toucher d'un jeton : 44 px de diamètre au moins (charte, §4). */
const RAYON_TOUCHER = 22;
const RAYON_JETON = 16;
/** En dessous de ce déplacement (pixels), un appui est un toucher, pas un glissé. */
const SEUIL_GLISSE = 6;

/** Une zone en cours de pose (l'outil de zone de la fiche). Les jetons n'y sont pas déplaçables. */
export interface ZonePosee {
  zone: ZoneAPoser;
  point?: Point;
  aim?: Point;
  /** Ce qu'un toucher sur le plan pose maintenant ; `null` : tout est posé. */
  etape: EtapeZone | null;
  onPoser: (etape: EtapeZone, p: Point) => void;
}

export interface PlanCombatProps {
  jetons: readonly JetonPlan[];
  /** Les jetons que cette personne déplace (le MJ : tous ; la joueuse : le sien). */
  deplacables: (id: string) => boolean;
  /** Sans cette fonction, le plan est en lecture seule. Elle lève une erreur dont le message s'affiche. */
  onDeplacer?: (id: string, position: Point | null) => Promise<MouvementRecu | null>;
  /** « Retirer du plan » (le MJ). */
  retirable?: boolean;
  /** Le jeton de la personne qui regarde. */
  moiId?: string | null;
  zone?: ZonePosee;
}

interface Glisse {
  id: string;
  pos: Point;
}

type Geste =
  | { type: "aucun" }
  | { type: "jeton"; id: string; pointeur: number; decalage: Point; depart: Point; bouge: boolean }
  | { type: "pan"; pointeur: number; dernier: Point; depart: Point; bouge: boolean; jetonTouche: string | null }
  | { type: "pincer"; dist: number; milieu: Point };

const COULEURS: Record<JetonPlan["camp"], { rond: string; texte: string }> = {
  ally: { rond: "fill-accent stroke-accent", texte: "fill-accent-ink" },
  enemy: { rond: "fill-danger stroke-danger", texte: "fill-accent-ink" },
  neutral: { rond: "fill-panel-raised stroke-edge-strong", texte: "fill-ink" },
};

const BOUTON_PETIT = "min-h-11 min-w-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

export default function PlanCombat({ jetons, deplacables, onDeplacer, retirable = false, moiId = null, zone }: PlanCombatProps) {
  const t = useTranslations("planCombat");
  const conteneur = useRef<HTMLDivElement | null>(null);
  const cadreRef = useRef<Cadre>({ largeur: 320, hauteur: 320 });
  const geste = useRef<Geste>({ type: "aucun" });
  const pointeurs = useRef(new Map<number, Point>());
  const cadrageFait = useRef(false);

  const [cadre, setCadre] = useState<Cadre>({ largeur: 320, hauteur: 320 });
  const [vue, setVue] = useState<VuePlan>(VUE_DEPART);
  const [surcharges, setSurcharges] = useState<Record<string, Surcharge>>({});
  const [glisse, setGlisse] = useState<Glisse | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [cibleToucher, setCibleToucher] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mouvement, setMouvement] = useState<{ nom: string; deplace: number; vitesse: number; depasse: boolean } | null>(null);

  // Les gestes lisent la vue et les jetons les plus récents sans se réabonner : copies tenues à jour après chaque rendu.
  const vueRef = useRef(vue);
  const jetonsRef = useRef<readonly JetonPlan[]>(jetons);
  useEffect(() => {
    vueRef.current = vue;
    jetonsRef.current = jetons;
  });

  // Les jetons tels qu'on les montre : la surcharge optimiste, puis le jeton en cours de glissé.
  const affiches: JetonPlan[] = jetons.map((j) => {
    const base = positionAffichee(j.pos, surcharges[j.id]);
    return { ...j, pos: glisse?.id === j.id ? glisse.pos : base };
  });
  const { poses, reserve } = repartir(affiches);

  // ---- le cadre : mesuré, jamais supposé ----

  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const mesure = { largeur: r.width, hauteur: r.height };
      cadreRef.current = mesure;
      setCadre(mesure);
      if (!cadrageFait.current) {
        cadrageFait.current = true;
        setVue(
          vueQuiCadre(
            jetonsRef.current.flatMap((j) => (j.pos ? [j.pos] : [])),
            mesure
          )
        );
      }
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  // ---- la molette : zoom autour du curseur (écouteur natif, non passif, pour retenir le défilement de la page) ----

  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const surMolette = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const facteur = Math.exp(-e.deltaY * 0.0015);
      setVue((v) => zoomerAutour(v, cadreRef.current, { x: e.clientX - r.left, y: e.clientY - r.top }, facteur));
    };
    el.addEventListener("wheel", surMolette, { passive: false });
    return () => el.removeEventListener("wheel", surMolette);
  }, []);

  function pointEcran(e: { clientX: number; clientY: number }): Point {
    const r = conteneur.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  // ---- le déplacement d'un jeton : une requête, au lâcher ----

  async function poser(id: string, position: Point | null) {
    if (!onDeplacer) return;
    const jeton = jetonsRef.current.find((j) => j.id === id);
    if (!jeton) return;
    setErreur(null);
    setSurcharges((s) => ({ ...s, [id]: { base: jeton.pos, pos: position } }));
    try {
      const mv = resumeMouvement(await onDeplacer(id, position));
      setMouvement(mv ? { nom: jeton.label, ...mv } : null);
    } catch (e) {
      // Refus ou réseau : le jeton revient où il était, et la raison s'affiche telle que la route l'a donnée.
      setSurcharges((s) => Object.fromEntries(Object.entries(s).filter(([cle]) => cle !== id)));
      setErreur(e instanceof Error ? e.message : t("erreurDeplacement"));
    }
  }

  function toucherJeton(id: string) {
    if (choisi !== null && choisi !== id) {
      setCibleToucher(id);
      return;
    }
    setChoisi(id);
    setCibleToucher(null);
  }

  function toucherFond(p: Point) {
    if (zone?.etape) {
      zone.onPoser(zone.etape, arrondiPose(ecranVersMetres(p, vueRef.current, cadreRef.current)));
      return;
    }
    setChoisi(null);
    setCibleToucher(null);
  }

  // ---- les doigts ----

  function surAppui(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointEcran(e);
    pointeurs.current.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (pointeurs.current.size >= 2) {
      // Deux doigts : on pince. Un glissé de jeton en cours est abandonné (le jeton revient).
      setGlisse(null);
      const [a, b] = [...pointeurs.current.values()];
      geste.current = { type: "pincer", dist: Math.hypot(a.x - b.x, a.y - b.y), milieu: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }

    const cible = e.target instanceof Element ? e.target.closest("[data-jeton]") : null;
    const id = cible?.getAttribute("data-jeton") ?? null;
    const jeton = id ? affiches.find((j) => j.id === id) : undefined;
    if (id && jeton?.pos && onDeplacer && !zone && deplacables(id)) {
      const sous = ecranVersMetres(p, vueRef.current, cadreRef.current);
      geste.current = { type: "jeton", id, pointeur: e.pointerId, decalage: { x: jeton.pos.x - sous.x, y: jeton.pos.y - sous.y }, depart: p, bouge: false };
      return;
    }
    geste.current = { type: "pan", pointeur: e.pointerId, dernier: p, depart: p, bouge: false, jetonTouche: id };
  }

  function surMouvement(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointeurs.current.has(e.pointerId)) return;
    const p = pointEcran(e);
    pointeurs.current.set(e.pointerId, p);
    const g = geste.current;

    if (g.type === "pincer" && pointeurs.current.size >= 2) {
      const [a, b] = [...pointeurs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const facteur = g.dist > 0 ? dist / g.dist : 1;
      setVue((v) => deplacerVue(zoomerAutour(v, cadreRef.current, milieu, facteur), milieu.x - g.milieu.x, milieu.y - g.milieu.y));
      geste.current = { type: "pincer", dist, milieu };
    } else if (g.type === "jeton" && g.pointeur === e.pointerId) {
      const bouge = g.bouge || Math.hypot(p.x - g.depart.x, p.y - g.depart.y) > SEUIL_GLISSE;
      if (bouge) {
        const sous = ecranVersMetres(p, vueRef.current, cadreRef.current);
        setGlisse({ id: g.id, pos: { x: sous.x + g.decalage.x, y: sous.y + g.decalage.y } });
        geste.current = { ...g, bouge: true };
      }
    } else if (g.type === "pan" && g.pointeur === e.pointerId) {
      const bouge = g.bouge || Math.hypot(p.x - g.depart.x, p.y - g.depart.y) > SEUIL_GLISSE;
      if (bouge) setVue((v) => deplacerVue(v, p.x - g.dernier.x, p.y - g.dernier.y));
      geste.current = { ...g, dernier: p, bouge };
    }
  }

  function surLever(e: React.PointerEvent<HTMLDivElement>, annule: boolean) {
    const p = pointEcran(e);
    pointeurs.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const g = geste.current;

    if (g.type === "pincer") {
      // Un doigt reste : le plan continue de suivre ce doigt, sans que ce soit un toucher.
      const [reste] = [...pointeurs.current.entries()];
      geste.current = reste ? { type: "pan", pointeur: reste[0], dernier: reste[1], depart: reste[1], bouge: true, jetonTouche: null } : { type: "aucun" };
      return;
    }
    geste.current = { type: "aucun" };

    if (g.type === "jeton" && g.pointeur === e.pointerId) {
      const fin = glisse;
      setGlisse(null);
      if (annule) return;
      if (g.bouge && fin) void poser(g.id, arrondiPose(fin.pos));
      else toucherJeton(g.id);
      if (g.bouge) {
        setChoisi(g.id);
        setCibleToucher(null);
      }
    } else if (g.type === "pan" && g.pointeur === e.pointerId && !g.bouge && !annule) {
      if (g.jetonTouche) toucherJeton(g.jetonTouche);
      else toucherFond(p);
    }
  }

  // ---- ce qu'on dessine ----

  const k = pixelsParMetre(vue);
  const ecran = (p: Point) => metresVersEcran(p, vue, cadre);
  const echelle = echelleBarre(vue);

  const jetonChoisi = choisi ? affiches.find((j) => j.id === choisi) : undefined;
  const autreId = survol ?? cibleToucher;
  const autre = autreId && autreId !== choisi ? affiches.find((j) => j.id === autreId) : undefined;
  const mesure = jetonChoisi?.pos && autre?.pos ? { de: jetonChoisi, vers: autre, metres: distanceAffichee(jetonChoisi.pos, autre.pos) } : null;

  const apercu = zone ? apercuZone({ zone: zone.zone, jetons: affiches, point: zone.point, aim: zone.aim }) : null;
  const dedans = new Set(apercu?.etat === "ok" ? apercu.ids : []);
  const contour = zone && apercu?.etat === "ok" ? contourZone(zone.zone.spec, apercu.origine, apercu.aim) : null;
  const etapesZoneListe = zone ? etapesZone(zone.zone.spec) : [];

  const peutRetirer = retirable && onDeplacer && jetonChoisi?.pos && deplacables(jetonChoisi.id) && !zone;

  return (
    <div className="flex flex-col gap-2" data-testid="plan-combat">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BOUTON_PETIT} onClick={() => setVue((v) => zoomerAutour(v, cadre, { x: cadre.largeur / 2, y: cadre.hauteur / 2 }, 1.5))} aria-label={t("zoomer")}>
          +
        </button>
        <button type="button" className={BOUTON_PETIT} onClick={() => setVue((v) => zoomerAutour(v, cadre, { x: cadre.largeur / 2, y: cadre.hauteur / 2 }, 1 / 1.5))} aria-label={t("dezoomer")}>
          −
        </button>
        <button
          type="button"
          className={BOUTON_PETIT}
          onClick={() =>
            setVue(
              vueQuiCadre(
                affiches.flatMap((j) => (j.pos ? [j.pos] : [])),
                cadre
              )
            )
          }
        >
          {t("recentrer")}
        </button>
        {peutRetirer && jetonChoisi && (
          <button type="button" className={`${BOUTON_PETIT} border-danger text-danger`} onClick={() => void poser(jetonChoisi.id, null)}>
            {t("retirerDuPlan", { nom: jetonChoisi.label })}
          </button>
        )}
      </div>

      <div
        ref={conteneur}
        className="relative h-[min(60vh,26rem)] w-full touch-none select-none overflow-hidden rounded-xl border border-edge bg-panel-sunken"
        onPointerDown={surAppui}
        onPointerMove={surMouvement}
        onPointerUp={(e) => surLever(e, false)}
        onPointerCancel={(e) => surLever(e, true)}
      >
        <svg width={cadre.largeur} height={cadre.hauteur} className="absolute inset-0" role="img" aria-label={t("planTitre")}>
          {contour?.type === "cercle" && (
            <circle cx={ecran(contour.centre).x} cy={ecran(contour.centre).y} r={contour.rayon * k} className="fill-accent/15 stroke-accent" strokeWidth={2} />
          )}
          {contour?.type === "polygone" && (
            <polygon
              points={contour.points.map((p) => `${ecran(p).x},${ecran(p).y}`).join(" ")}
              className="fill-accent/15 stroke-accent"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}
          {zone?.point && <circle cx={ecran(zone.point).x} cy={ecran(zone.point).y} r={5} className="fill-accent" />}
          {zone?.aim && (
            <circle cx={ecran(zone.aim).x} cy={ecran(zone.aim).y} r={5} className="fill-none stroke-accent" strokeWidth={2} />
          )}

          {mesure && mesure.de.pos && mesure.vers.pos && (
            <g pointerEvents="none">
              <line
                x1={ecran(mesure.de.pos).x}
                y1={ecran(mesure.de.pos).y}
                x2={ecran(mesure.vers.pos).x}
                y2={ecran(mesure.vers.pos).y}
                className="stroke-ink-soft"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            </g>
          )}

          {poses.map((j) => {
            const s = ecran(j.pos);
            const c = COULEURS[j.camp];
            const enGlisse = glisse?.id === j.id;
            return (
              <g
                key={j.id}
                data-jeton={j.id}
                transform={`translate(${s.x} ${s.y})`}
                opacity={j.abattu ? 0.45 : 1}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSurvol(j.id)}
                onPointerLeave={() => setSurvol((v) => (v === j.id ? null : v))}
                className={onDeplacer && !zone && deplacables(j.id) ? "cursor-grab" : "cursor-pointer"}
              >
                <title>{j.label}</title>
                {/* La cible de toucher : 44 px au moins, invisible. */}
                <circle r={RAYON_TOUCHER} className="fill-transparent" />
                {j.actif && <circle r={RAYON_JETON + 5} className="fill-none stroke-ink" strokeWidth={2} />}
                {dedans.has(j.id) && <circle r={RAYON_JETON + 5} className="fill-none stroke-success" strokeWidth={3} />}
                {choisi === j.id && <circle r={RAYON_JETON + 8} className="fill-none stroke-ink-soft" strokeWidth={1.5} strokeDasharray="3 3" />}
                <circle r={enGlisse ? RAYON_JETON + 3 : RAYON_JETON} className={c.rond} strokeWidth={j.id === moiId ? 3 : 1} />
                <text textAnchor="middle" dominantBaseline="central" className={`${c.texte} pointer-events-none text-xs font-semibold`}>
                  {initiales(j.label)}
                </text>
                <text y={RAYON_JETON + 13} textAnchor="middle" className="pointer-events-none fill-ink text-xs">
                  {j.label}
                </text>
              </g>
            );
          })}

          {mesure && mesure.de.pos && mesure.vers.pos && (
            <text
              x={(ecran(mesure.de.pos).x + ecran(mesure.vers.pos).x) / 2}
              y={(ecran(mesure.de.pos).y + ecran(mesure.vers.pos).y) / 2 - 6}
              textAnchor="middle"
              className="pointer-events-none fill-ink text-xs font-semibold"
              paintOrder="stroke"
              strokeWidth={4}
              stroke="var(--color-panel-sunken, transparent)"
            >
              {t("metres", { n: mesure.metres })}
            </text>
          )}
        </svg>

        {/* L'échelle en mètres, toujours visible. */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-0.5" aria-hidden="true">
          <span className="font-mech text-xs text-ink-soft">{t("metres", { n: echelle.metres })}</span>
          <span className="block h-1.5 border-x-2 border-b-2 border-ink-soft" style={{ width: echelle.px }} />
        </div>

        {poses.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-xs italic text-ink-muted">{t("planVide")}</p>
        )}
      </div>

      {/* Ce que le plan dit, pour tout le monde (lecteurs d'écran compris). */}
      <div className="flex flex-col gap-1 text-xs" aria-live="polite">
        {mesure ? (
          <p className="text-ink" data-testid="plan-distance">
            {t("distanceEntre", { de: mesure.de.label, vers: mesure.vers.label, n: mesure.metres })}
          </p>
        ) : (
          <p className="text-ink-muted">{t("aide")}</p>
        )}
        {mouvement && (
          <p className={mouvement.depasse ? "text-accent" : "text-ink-soft"} data-testid="plan-mouvement">
            {t("mouvementTour", { nom: mouvement.nom, deplace: mouvement.deplace, vitesse: mouvement.vitesse })}
            {mouvement.depasse && ` ${t("mouvementDepasse")}`}
          </p>
        )}
        {zone && (
          <p className="text-ink-soft">
            {zone.etape ? t(`etape.${zone.etape}`) : t("zonePosee")}
            {etapesZoneListe.length === 0 && ` ${t("zoneDepuisSoi")}`}
          </p>
        )}
      </div>
      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      {reserve.length > 0 && (
        <section className="flex flex-col gap-1" aria-label={t("reserveTitre")}>
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("reserveTitre")}</span>
          <div className="flex flex-wrap gap-1.5">
            {reserve.map((j) =>
              onDeplacer && !zone && deplacables(j.id) ? (
                <button
                  key={j.id}
                  type="button"
                  className={BOUTON_PETIT}
                  onClick={() => void poser(j.id, arrondiPose(vue.centre))}
                  aria-label={t("poserAuCentre", { nom: j.label })}
                >
                  {j.label}
                </button>
              ) : (
                <span key={j.id} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted">
                  {j.label}
                </span>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
