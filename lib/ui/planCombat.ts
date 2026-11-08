import { areaTargets, distance, type AreaPlacement, type Point } from "@/src/core/rules/geometry";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
import type { CombatParticipantRow } from "@/src/server/repos/combats";

/**
 * V3.1-170 (ADR 0077) — le plan du combat, sans écran : les conversions entre
 * l'écran (pixels) et le plan (mètres), le zoom, l'arrondi d'affichage, la
 * répartition des jetons, la mise à jour optimiste et l'aperçu de l'outil de
 * zone. La géométrie (distance, qui est dans une zone) n'est PAS réécrite ici :
 * elle vient de `src/core/rules/geometry.ts`, que le serveur emploie aussi.
 */

export type { Point };

// --- La vue : où l'on regarde, et de combien --------------------------------

/** `centre` est le point du plan (mètres) qui tombe au milieu du cadre. */
export interface VuePlan {
  zoom: number;
  centre: Point;
}

/** La taille du cadre, en pixels. */
export interface Cadre {
  largeur: number;
  hauteur: number;
}

/** Pixels par mètre à zoom 1 : 1,5 m (un contact) fait alors 48 px. */
export const PX_PAR_METRE = 32;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;
/** Les bornes du serveur (`zMetres`) : un jeton ne se pose pas au-delà. */
export const LIMITE_PLAN = 1000;

export const VUE_DEPART: VuePlan = { zoom: 1, centre: { x: 0, y: 0 } };

export function pixelsParMetre(vue: VuePlan): number {
  return PX_PAR_METRE * vue.zoom;
}

export function metresVersEcran(p: Point, vue: VuePlan, cadre: Cadre): Point {
  const k = pixelsParMetre(vue);
  return { x: cadre.largeur / 2 + (p.x - vue.centre.x) * k, y: cadre.hauteur / 2 + (p.y - vue.centre.y) * k };
}

export function ecranVersMetres(s: Point, vue: VuePlan, cadre: Cadre): Point {
  const k = pixelsParMetre(vue);
  return { x: vue.centre.x + (s.x - cadre.largeur / 2) / k, y: vue.centre.y + (s.y - cadre.hauteur / 2) / k };
}

const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Faire glisser le plan de `dx`, `dy` pixels : le plan suit le doigt. */
export function deplacerVue(vue: VuePlan, dx: number, dy: number): VuePlan {
  const k = pixelsParMetre(vue);
  return { zoom: vue.zoom, centre: { x: vue.centre.x - dx / k, y: vue.centre.y - dy / k } };
}

/** Zoomer en gardant sous le doigt (ou le curseur) le point du plan qui s'y trouvait. */
export function zoomerAutour(vue: VuePlan, cadre: Cadre, ecran: Point, facteur: number): VuePlan {
  const sous = ecranVersMetres(ecran, vue, cadre);
  const zoom = borner(vue.zoom * facteur, ZOOM_MIN, ZOOM_MAX);
  const apres = ecranVersMetres(ecran, { zoom, centre: vue.centre }, cadre);
  return { zoom, centre: { x: vue.centre.x + (sous.x - apres.x), y: vue.centre.y + (sous.y - apres.y) } };
}

/** Une vue qui montre tous les points, avec une marge ; la vue de départ s'il n'y en a aucun. */
export function vueQuiCadre(points: readonly Point[], cadre: Cadre, marge = 3): VuePlan {
  if (points.length === 0) return VUE_DEPART;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const largeur = Math.max(12, Math.max(...xs) - Math.min(...xs) + 2 * marge);
  const hauteur = Math.max(12, Math.max(...ys) - Math.min(...ys) + 2 * marge);
  const zoom = borner(Math.min(cadre.largeur / (largeur * PX_PAR_METRE), cadre.hauteur / (hauteur * PX_PAR_METRE)), ZOOM_MIN, ZOOM_MAX);
  return { zoom, centre: { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 } };
}

// --- L'affichage des mètres --------------------------------------------------

/** Les mètres s'affichent au demi-mètre (le plan n'est pas une règle graduée). */
export function arrondiDemi(m: number): number {
  return Math.round(m * 2) / 2;
}

export function distanceAffichee(a: Point, b: Point): number {
  return arrondiDemi(distance(a, b));
}

/** Une position posée : au centimètre (pas de bruit de virgule flottante), dans les bornes que le serveur accepte. */
export function arrondiPose(p: Point): Point {
  const net = (n: number) => borner(Math.round(n * 100) / 100, -LIMITE_PLAN, LIMITE_PLAN) + 0;
  return { x: net(p.x), y: net(p.y) };
}

const LONGUEURS_RONDES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500] as const;
const ECHELLE_MAX_PX = 120;

/** La barre d'échelle : la plus longue longueur ronde qui tient dans 120 px. */
export function echelleBarre(vue: VuePlan): { metres: number; px: number } {
  const k = pixelsParMetre(vue);
  let choix: number = LONGUEURS_RONDES[0];
  for (const m of LONGUEURS_RONDES) if (m * k <= ECHELLE_MAX_PX) choix = m;
  return { metres: choix, px: choix * k };
}

// --- Les jetons --------------------------------------------------------------

export type CampJeton = "ally" | "enemy" | "neutral";

export interface JetonPlan {
  id: string;
  label: string;
  /** `null` : pas encore posé sur le plan (il attend dans la réserve). */
  pos: Point | null;
  camp: CampJeton;
  /** Hors de combat : le jeton reste, grisé. */
  abattu: boolean;
  /** C'est son tour. */
  actif: boolean;
}

export type LigneMj = Pick<CombatParticipantRow, "id" | "label" | "is_ally" | "pos_x" | "pos_y" | "hp_max" | "hp_current">;

/** Une demi-position n'est pas une position : il faut les deux coordonnées. */
export function jetonsDepuisLignes(lignes: readonly LigneMj[], actifId: string | null): JetonPlan[] {
  return lignes.map((l) => ({
    id: l.id,
    label: l.label,
    pos: l.pos_x !== null && l.pos_y !== null ? { x: l.pos_x, y: l.pos_y } : null,
    camp: l.is_ally ? "ally" : "enemy",
    abattu: l.hp_max !== null && l.hp_current === 0,
    actif: l.id === actifId,
  }));
}

export type LigneJoueuse = Pick<PlayerCombatParticipant, "id" | "label" | "side" | "position" | "wound" | "isCurrent">;

export function jetonsDepuisVue(participants: readonly LigneJoueuse[]): JetonPlan[] {
  return participants.map((p) => ({
    id: p.id,
    label: p.label,
    pos: p.position,
    camp: p.side,
    abattu: p.wound === "down",
    actif: p.isCurrent,
  }));
}

export type JetonPose = JetonPlan & { pos: Point };

export function repartir(jetons: readonly JetonPlan[]): { poses: JetonPose[]; reserve: JetonPlan[] } {
  const poses: JetonPose[] = [];
  const reserve: JetonPlan[] = [];
  for (const j of jetons) {
    if (j.pos) poses.push({ ...j, pos: j.pos });
    else reserve.push(j);
  }
  return { poses, reserve };
}

/** Deux lettres au plus, pour l'intérieur du jeton ; `?` pour un nom vide. */
export function initiales(label: string): string {
  const mots = label.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

// --- La mise à jour optimiste ------------------------------------------------

/** Un déplacement lâché, en attente de l'écho du serveur : la position AVANT et celle où l'on a posé. */
export interface Surcharge {
  base: Point | null;
  pos: Point | null;
}

function memePoint(a: Point | null, b: Point | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.x - b.x) < 0.005 && Math.abs(a.y - b.y) < 0.005;
}

/**
 * La position à montrer. Tant que la donnée reçue est encore celle d'avant le
 * lâcher, le jeton reste où on l'a posé ; dès qu'elle change (le serveur a
 * rattrapé, ou quelqu'un d'autre l'a bougé), elle l'emporte.
 */
export function positionAffichee(recue: Point | null, surcharge: Surcharge | undefined): Point | null {
  if (!surcharge) return recue;
  if (memePoint(recue, surcharge.base)) return surcharge.pos;
  return recue;
}

// --- Le mouvement du tour ----------------------------------------------------

export interface MouvementRecu {
  moved: number;
  speed: number;
  over: boolean;
}

export function resumeMouvement(m: MouvementRecu | null): { deplace: number; vitesse: number; depasse: boolean } | null {
  if (!m) return null;
  return { deplace: arrondiDemi(m.moved), vitesse: arrondiDemi(m.speed), depasse: m.over };
}

// --- L'outil de zone ---------------------------------------------------------

export interface ZoneAPoser {
  spec: AreaPlacement;
  /** Le participant qui lance : son jeton est l'origine d'une zone « depuis soi ». */
  lanceurId: string;
  /** Portée en mètres d'une zone posée à un point. */
  portee?: number;
}

export type EtapeZone = "point" | "aim";

/** Ce que le joueur doit poser : un point (origine « point »), une direction (cône, ligne). */
export function etapesZone(spec: AreaPlacement): EtapeZone[] {
  const etapes: EtapeZone[] = [];
  if (spec.origin === "point") etapes.push("point");
  if (spec.shape === "cone" || spec.shape === "line") etapes.push("aim");
  return etapes;
}

export function etapeSuivante(spec: AreaPlacement, pose: { point?: Point; aim?: Point }): EtapeZone | null {
  return etapesZone(spec).find((e) => pose[e] === undefined) ?? null;
}

export type ApercuZone =
  | { etat: "ok"; ids: string[]; origine: Point; aim?: Point }
  | { etat: "incomplet"; manque: "no_position" | "no_point" | "no_aim" | "out_of_range" };

/** Qui est dans la zone posée : le calcul du serveur, vu avant de valider (les jetons non posés ne sont jamais dedans). */
export function apercuZone(p: { zone: ZoneAPoser; jetons: readonly JetonPlan[]; point?: Point; aim?: Point }): ApercuZone {
  const lanceur = p.jetons.find((j) => j.id === p.zone.lanceurId);
  const r = areaTargets({
    area: p.zone.spec,
    caster: { id: p.zone.lanceurId, pos: lanceur?.pos ?? null },
    point: p.point,
    aim: p.aim,
    range: p.zone.portee,
    others: p.jetons.filter((j) => j.id !== p.zone.lanceurId || p.zone.spec.origin === "point").map((j) => ({ id: j.id, pos: j.pos })),
  });
  if (!r.ok) return { etat: "incomplet", manque: r.reason };
  const origine = p.zone.spec.origin === "self" ? (lanceur?.pos ?? { x: 0, y: 0 }) : (p.point ?? { x: 0, y: 0 });
  return { etat: "ok", ids: r.ids, origine, ...(p.aim ? { aim: p.aim } : {}) };
}

export type ContourZone = { type: "cercle"; centre: Point; rayon: number } | { type: "polygone"; points: Point[] };

/** Le dessin de la zone, en mètres ; `null` s'il manque la direction d'un cône ou d'une ligne. */
export function contourZone(spec: AreaPlacement, origine: Point, aim?: Point): ContourZone | null {
  if (spec.shape === "sphere") return { type: "cercle", centre: origine, rayon: spec.size };
  if (spec.shape === "cube") {
    const h = spec.size / 2;
    return {
      type: "polygone",
      points: [
        { x: origine.x - h, y: origine.y - h },
        { x: origine.x + h, y: origine.y - h },
        { x: origine.x + h, y: origine.y + h },
        { x: origine.x - h, y: origine.y + h },
      ],
    };
  }
  if (!aim) return null;
  const longueur = distance(origine, aim);
  if (longueur === 0) return null;
  const ux = (aim.x - origine.x) / longueur;
  const uy = (aim.y - origine.y) / longueur;
  const bout = { x: origine.x + ux * spec.size, y: origine.y + uy * spec.size };
  // Le cône s'ouvre comme sa distance (largeur au bout = longueur) ; la ligne garde sa largeur (1,5 m par défaut).
  const demi = spec.shape === "cone" ? spec.size / 2 : (spec.width ?? 1.5) / 2;
  const nx = -uy * demi;
  const ny = ux * demi;
  const cote = (s: 1 | -1): Point => ({ x: bout.x + s * nx, y: bout.y + s * ny });
  if (spec.shape === "cone") return { type: "polygone", points: [origine, cote(1), cote(-1)] };
  return {
    type: "polygone",
    points: [
      { x: origine.x + nx, y: origine.y + ny },
      cote(1),
      cote(-1),
      { x: origine.x - nx, y: origine.y - ny },
    ],
  };
}

/**
 * Le MJ peut décocher des cibles d'une zone. Toutes gardées : on n'envoie rien
 * (le serveur calcule). Certaines retirées : on envoie celles qu'il garde.
 * Toutes retirées serait lu « aucune restriction » : refusé.
 */
export function ciblesAEnvoyer(dedans: readonly string[], gardees: readonly string[]): { ids: string[]; valide: boolean } {
  if (dedans.length === 0) return { ids: [], valide: true };
  const gardes = dedans.filter((id) => gardees.includes(id));
  if (gardes.length === dedans.length) return { ids: [], valide: true };
  if (gardes.length === 0) return { ids: [], valide: false };
  return { ids: gardes, valide: true };
}
