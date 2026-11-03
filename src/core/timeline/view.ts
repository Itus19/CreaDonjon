import type { CalendarEra } from "../calendar/types";
import type { TimelineScope } from "../schemas/blocks/timeline";

/**
 * La frise horizontale de la Chronologie (V3.1-97) : tout le calcul de la vue,
 * en fonctions pures. L'écran (V3.1-98) ne fait que dessiner ce qu'on lui rend.
 *
 * Une vue = un centre et une étendue, en années (fractionnaires). Une date de
 * jeu devient une abscisse en années avec `yearPosition` (calendar/axisPosition),
 * calculée par l'appelant : ce module ne connaît que des `TimelinePoint`.
 */

/** Marge de chaque côté de l'axe, en px. */
export const VIEW_MARGIN = 110;
/** Largeur d'une carte, en px. */
export const CARD_WIDTH = 186;
/** Étendue minimale d'une vue, en années. */
export const MIN_SPAN = 20;

export const DETAIL_MAJOR_ABOVE = 400;
export const DETAIL_NOTABLE_FROM = 130;

export const SCROLL_RATIO = 0.12;
export const STEP_RATIO = 0.3;
const WHEEL_ZOOM_OUT = 1.25;
const BUTTON_ZOOM_OUT = 1.6;

export type View = { center: number; span: number };
export type WorldExtent = { start: number; end: number };
/** Une date placée sur la frise : un identifiant, sa position en années, sa portée résolue (`resolveScope`). */
export type TimelinePoint = { id: string; year: number; scope: TimelineScope };

/* ------------------------------------------------------------------ échelle */

export function viewRange(view: View): { start: number; end: number } {
  return { start: view.center - view.span / 2, end: view.center + view.span / 2 };
}

/** Abscisse (px) d'une année pour une frise de `width` px de large. */
export function xOfYear(year: number, view: View, width: number): number {
  const { start } = viewRange(view);
  return VIEW_MARGIN + ((year - start) / view.span) * (width - 2 * VIEW_MARGIN);
}

/** L'année sous une abscisse (px) : inverse de `xOfYear`. */
export function yearOfX(x: number, view: View, width: number): number {
  const { start } = viewRange(view);
  return start + ((x - VIEW_MARGIN) / (width - 2 * VIEW_MARGIN)) * view.span;
}

/** Étendue bornée entre 20 ans et l'étendue du monde (un monde de moins de 20 ans garde 20 ans). */
export function clampSpan(span: number, worldSpan: number): number {
  return Math.max(MIN_SPAN, Math.min(span, Math.max(worldSpan, MIN_SPAN)));
}

/** L'étendue du monde : de la date la plus ancienne (dates, ères) à la plus récente (dates, aujourd'hui), au moins 20 ans. */
export function worldExtent(years: number[], eras: CalendarEra[], todayYear: number | null): WorldExtent {
  const all = [...years, ...eras.map((e) => e.startYear), ...(todayYear === null ? [] : [todayYear])];
  if (all.length === 0) return { start: 0, end: MIN_SPAN };
  let start = Math.min(...all);
  let end = Math.max(...all);
  if (end - start < MIN_SPAN) {
    const mid = (start + end) / 2;
    start = mid - MIN_SPAN / 2;
    end = mid + MIN_SPAN / 2;
  }
  return { start, end };
}

/* ---------------------------------------------------- niveau de détail */

export type DetailLevel = "major" | "notable" | "all";

/** > 400 ans : major ; de 130 à 400 inclus : major + notable ; < 130 : tout. */
export function detailLevel(span: number): DetailLevel {
  if (span > DETAIL_MAJOR_ABOVE) return "major";
  if (span >= DETAIL_NOTABLE_FROM) return "notable";
  return "all";
}

function isShownAt(scope: TimelineScope, level: DetailLevel): boolean {
  if (level === "all") return true;
  if (level === "notable") return scope !== "detail";
  return scope === "major";
}

function inView(year: number, view: View): boolean {
  const { start, end } = viewRange(view);
  return year >= start && year <= end;
}

export type ViewSummary = {
  level: DetailLevel;
  /** Dates de la vue montrées au niveau de détail courant. */
  visibleCount: number;
  /** Dates de la vue cachées par le niveau de détail (« n de plus en zoomant »). */
  hiddenCount: number;
};

export function summarizeView(points: TimelinePoint[], view: View): ViewSummary {
  const level = detailLevel(view.span);
  let visibleCount = 0;
  let hiddenCount = 0;
  for (const p of points) {
    if (!inView(p.year, view)) continue;
    if (isShownAt(p.scope, level)) visibleCount++;
    else hiddenCount++;
  }
  return { level, visibleCount, hiddenCount };
}

/** Le libellé de la barre du haut (texte imposé par le ticket ; fonction séparée pour que l'écran puisse le traduire). */
export function viewLabel(span: number, level: DetailLevel): string {
  const detail =
    level === "all" ? "tout, jusqu'aux naissances" : level === "notable" ? "grandes dates et notables" : "grandes dates seulement";
  return `Vue : ${Math.round(span)} ans · ${detail}`;
}

/* ------------------------------------------------------------ graduations */

/** Pas des graduations : 250 > 800 ; 100 > 300 ; 50 > 120 ; 10 > 50 ; sinon 5. */
export function graduationStep(span: number): number {
  if (span > 800) return 250;
  if (span > 300) return 100;
  if (span > 120) return 50;
  if (span > 50) return 10;
  return 5;
}

/** Les années graduées (multiples du pas) comprises dans la vue. */
export function graduationTicks(view: View): number[] {
  const step = graduationStep(view.span);
  const { start, end } = viewRange(view);
  const ticks: number[] = [];
  for (let y = Math.ceil(start / step) * step; y <= end; y += step) ticks.push(y);
  return ticks;
}

/* ------------------------------------------------- rangement des cartes */

export type CardSide = "above" | "below";

export type PlacedCard = {
  id: string;
  year: number;
  x: number;
  side: CardSide;
  /** Les dates rattachées à cette carte (« + n autour ») et la plage d'années à viser pour zoomer dessus (carte comprise) ; `null` s'il n'y en a pas. */
  more: { count: number; ids: string[]; range: { start: number; end: number } | null };
};

export type CardLayout = {
  /** Une date qui ne tient pas est rattachée à une carte voisine (`more`), jamais perdue. */
  cards: PlacedCard[];
};

/**
 * Range les dates visibles de la vue, de gauche à droite : côté alterné ; si
 * la carte chevauche la précédente du côté voulu, l'autre côté ; si les deux
 * sont pris, la date rejoint la carte voisine la plus proche en abscisse.
 */
export function layoutCards(points: TimelinePoint[], view: View, width: number): CardLayout {
  const level = detailLevel(view.span);
  const shown = points
    .filter((p) => inView(p.year, view) && isShownAt(p.scope, level))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

  const cards: PlacedCard[] = [];
  const lastBySide: Record<CardSide, PlacedCard | null> = { above: null, below: null };
  const free = (side: CardSide, x: number): boolean => {
    const last = lastBySide[side];
    return last === null || x - last.x >= CARD_WIDTH;
  };

  let next: CardSide = "above";
  for (const p of shown) {
    const x = xOfYear(p.year, view, width);
    const other: CardSide = next === "above" ? "below" : "above";
    const side: CardSide | null = free(next, x) ? next : free(other, x) ? other : null;
    if (side !== null) {
      const card: PlacedCard = { id: p.id, year: p.year, x, side, more: { count: 0, ids: [], range: null } };
      cards.push(card);
      lastBySide[side] = card;
      next = side === "above" ? "below" : "above";
      continue;
    }
    // Les deux côtés sont pris : la carte voisine la plus proche l'absorbe.
    const a = lastBySide.above;
    const b = lastBySide.below;
    const host = a !== null && b !== null ? (Math.abs(x - a.x) <= Math.abs(x - b.x) ? a : b) : (a ?? b);
    if (host === null) continue; // impossible : un côté libre existe tant qu'aucune carte n'est posée
    host.more.count++;
    host.more.ids.push(p.id);
    host.more.range = {
      start: Math.min(host.more.range?.start ?? host.year, host.year, p.year),
      end: Math.max(host.more.range?.end ?? host.year, host.year, p.year),
    };
  }
  return { cards };
}

/* ------------------------------------------------------------------- ères */

export type EraBand = {
  name: string;
  /** Début et fin visibles (coupés aux bords de la vue), en années. */
  startYear: number;
  endYear: number;
  x0: number;
  x1: number;
  /** Où poser le nom : le milieu de la partie visible. */
  labelX: number;
  cutLeft: boolean;
  cutRight: boolean;
};

/** Les ères en bandeaux : de leur `startYear` à la suivante (la dernière jusqu'à `todayYear`), coupées aux bords de la vue. */
export function eraBands(eras: CalendarEra[], view: View, width: number, todayYear: number): EraBand[] {
  const sorted = [...eras].sort((a, b) => a.startYear - b.startYear);
  const { start: vStart, end: vEnd } = viewRange(view);
  const bands: EraBand[] = [];
  sorted.forEach((era, i) => {
    const eraEnd = i + 1 < sorted.length ? sorted[i + 1].startYear : Math.max(todayYear, era.startYear);
    const startYear = Math.max(era.startYear, vStart);
    const endYear = Math.min(eraEnd, vEnd);
    if (endYear <= startYear) return;
    const x0 = xOfYear(startYear, view, width);
    const x1 = xOfYear(endYear, view, width);
    bands.push({
      name: era.name,
      startYear,
      endYear,
      x0,
      x1,
      labelX: (x0 + x1) / 2,
      cutLeft: era.startYear < vStart,
      cutRight: eraEnd > vEnd,
    });
  });
  return bands;
}

/* ----------------------------------------------------------------- gestes */

function clampCenter(center: number, world: WorldExtent): number {
  return Math.max(world.start, Math.min(center, world.end));
}

function worldSpan(world: WorldExtent): number {
  return world.end - world.start;
}

/** Molette : défiler de ±12 % de l'étendue (`direction` : 1 vers la droite, -1 vers la gauche). */
export function scrollView(view: View, direction: 1 | -1, world: WorldExtent): View {
  return { ...view, center: clampCenter(view.center + direction * SCROLL_RATIO * view.span, world) };
}

/** Boutons ‹ › : ±30 %. */
export function stepView(view: View, direction: 1 | -1, world: WorldExtent): View {
  return { ...view, center: clampCenter(view.center + direction * STEP_RATIO * view.span, world) };
}

/** Facteur d'étendue : Ctrl + molette ×1,25 / ×0,8 ; boutons − / + ×1,6 (zoomer = réduire l'étendue). */
export function zoomFactor(direction: "in" | "out", source: "wheel" | "button"): number {
  const out = source === "wheel" ? WHEEL_ZOOM_OUT : BUTTON_ZOOM_OUT;
  return direction === "out" ? out : 1 / out;
}

/** Zoom autour d'une année : elle reste à la même place à l'écran (sauf si le centre doit être ramené dans le monde). */
export function zoomAround(view: View, factor: number, anchorYear: number, world: WorldExtent): View {
  const span = clampSpan(view.span * factor, worldSpan(world));
  const { start } = viewRange(view);
  const fraction = (anchorYear - start) / view.span;
  const newStart = anchorYear - fraction * span;
  return { center: clampCenter(newStart + span / 2, world), span };
}

export type ViewPreset = "world" | "era" | "century" | "life";
const PRESET_SPAN: Record<Exclude<ViewPreset, "world">, number> = { era: 400, century: 130, life: 60 };

/** Préréglages : Le monde (tout, centré), Une ère (400), Un siècle (130), Une vie (60), centrés comme la vue courante. */
export function presetView(preset: ViewPreset, current: View, world: WorldExtent): View {
  if (preset === "world") return { center: (world.start + world.end) / 2, span: clampSpan(worldSpan(world), worldSpan(world)) };
  return { center: clampCenter(current.center, world), span: clampSpan(PRESET_SPAN[preset], worldSpan(world)) };
}

/** Centrer sur aujourd'hui : même étendue, aujourd'hui au quart gauche de la vue. */
export function centerOnToday(view: View, todayYear: number, world: WorldExtent): View {
  return { span: view.span, center: clampCenter(todayYear + view.span / 4, world) };
}
