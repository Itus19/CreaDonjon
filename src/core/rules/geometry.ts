/**
 * V3.1-168 (ADR 0077) — la géométrie du plan, sans grille : des positions en
 * mètres, des distances euclidiennes, et ce qu'une zone (cône, ligne, sphère,
 * cube) contient. Un jeton est un point : la taille des créatures n'entre pas
 * encore en compte. Pure : aucun dé, aucune base.
 */

export interface Point {
  x: number;
  y: number;
}

export type AreaShape = "cone" | "line" | "sphere" | "cube";

export interface AreaSpec {
  shape: AreaShape;
  /** Longueur d'un cône ou d'une ligne, rayon d'une sphère, côté d'un cube (mètres). */
  size: number;
  /** Largeur d'une ligne (mètres) ; 1,5 m par défaut. */
  width?: number;
}

export const CONTACT_METRES = 1.5;
export const PROCHE_METRES = 9;

/**
 * Une vitesse en pieds (unité native du SRD) lue en mètres du plan, selon la
 * convention du SRD français : 1,5 m pour 5 pieds (9 m pour 30 pieds).
 */
export function feetToPlanMetres(ft: number): number {
  return Math.round(ft * 0.3 * 100) / 100;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** La lecture des trois zones du solo (ADR 0059) depuis une distance. */
export function zoneFromDistance(d: number): "engaged" | "near" | "far" {
  if (d <= CONTACT_METRES) return "engaged";
  if (d <= PROCHE_METRES) return "near";
  return "far";
}

/** Une petite tolérance : une créature posée pile sur le bord d'une zone est dedans. */
const EPS = 1e-9;

/**
 * Le point `p` est-il dans la zone ? `origin` est d'où part la zone (le
 * lanceur pour un cône ou une ligne, le centre pour une sphère ou un cube) ;
 * `aim` donne la direction d'un cône ou d'une ligne (ignoré sinon). Un cône
 * s'élargit comme le veut la règle : sa largeur à une distance égale cette
 * distance. Ni un cône ni une ligne ne contiennent leur origine.
 */
export function inArea(area: AreaSpec, origin: Point, aim: Point, p: Point): boolean {
  if (area.shape === "sphere") return distance(origin, p) <= area.size + EPS;
  if (area.shape === "cube") return Math.abs(p.x - origin.x) <= area.size / 2 + EPS && Math.abs(p.y - origin.y) <= area.size / 2 + EPS;
  const dx = aim.x - origin.x;
  const dy = aim.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;
  const ux = dx / len;
  const uy = dy / len;
  const vx = p.x - origin.x;
  const vy = p.y - origin.y;
  const along = vx * ux + vy * uy;
  const across = Math.abs(vx * uy - vy * ux);
  if (along <= EPS || along > area.size + EPS) return false;
  if (area.shape === "line") return across <= (area.width ?? CONTACT_METRES) / 2 + EPS;
  return across <= along / 2 + EPS;
}
