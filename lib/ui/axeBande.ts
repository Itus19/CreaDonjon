/**
 * V3.1-68 — noyau pur de l'axe en bande de la Chronologie : le domaine
 * affiché, les ères en segments nommés, les événements en points, les
 * périodes en barres et le trait doré du jour actuel. Le composant ne fait
 * que dessiner ; tout se calcule ici, en « années » (la même unité que
 * `yearPosition`, `src/core/calendar/axisPosition.ts`), sans navigateur.
 */

import { yearPosition } from "@/src/core/calendar/axisPosition";
import type { CalendarConfig } from "@/src/core/calendar/types";
import type { TimelineEntry, TimelineEntryKind } from "@/src/core/schemas/blocks/timeline";

export interface EntreePositionnee {
  id: string;
  /** Position de la date, en années. */
  debut: number;
  /** Fin d'une période (`date.end`), en années ; `null` pour un événement ponctuel. */
  fin: number | null;
}

export interface Domaine {
  min: number;
  max: number;
}

/** Les positions en années de chaque événement, d'après le calendrier du monde. */
export function positionnerEntrees(entries: readonly TimelineEntry[], calendar: CalendarConfig): EntreePositionnee[] {
  return entries.map((e) => ({
    id: e.id,
    debut: yearPosition(e.date, calendar),
    fin: e.date.end ? yearPosition(e.date.end, calendar) : null,
  }));
}

/** La position en années du jour actuel du monde ; `null` tant que le MJ ne l'a pas réglé. */
export function positionAujourdhui(
  currentDate: Parameters<typeof yearPosition>[0] | null | undefined,
  calendar: CalendarConfig,
): number | null {
  return currentDate ? yearPosition(currentDate, calendar) : null;
}

/**
 * Ce que l'axe montre : tout ce qui est posé (événements, fins de période,
 * jour actuel), avec une marge de 8 % de chaque côté. Sans rien : autour du
 * jour actuel s'il existe, sinon de 0 à 100 ans. Un seul point reçoit une
 * fenêtre d'un an.
 */
export function calculerDomaine(entrees: readonly EntreePositionnee[], aujourdhui: number | null): Domaine {
  const valeurs = entrees.flatMap((e) => (e.fin === null ? [e.debut] : [e.debut, e.fin]));
  if (aujourdhui !== null) valeurs.push(aujourdhui);
  if (valeurs.length === 0) return { min: 0, max: 100 };
  const bas = Math.min(...valeurs);
  const haut = Math.max(...valeurs);
  const etendue = Math.max(haut - bas, 1);
  const centre = (bas + haut) / 2;
  const marge = etendue * 0.08;
  return { min: centre - etendue / 2 - marge, max: centre + etendue / 2 + marge };
}

/** Position horizontale en pour cent (0 = bord gauche de l'axe, 100 = bord droit). */
export function pourcent(an: number, domaine: Domaine): number {
  return ((an - domaine.min) / (domaine.max - domaine.min)) * 100;
}

/** L'inverse de `pourcent` : l'année sous un point de l'axe (pour ajouter un événement d'un toucher). Bornée à l'axe. */
export function anAuPourcent(pct: number, domaine: Domaine): number {
  const borne = Math.min(100, Math.max(0, pct));
  return domaine.min + (borne / 100) * (domaine.max - domaine.min);
}

export interface SegmentEre {
  nom: string;
  gauche: number;
  largeur: number;
}

/**
 * Les ères du calendrier qui tombent dans le domaine, chacune de son
 * `startYear` à celui de la suivante (la dernière va jusqu'au bord). Une ère
 * est rognée aux bords de l'axe ; ce qui précède la première ère n'a pas de
 * segment.
 */
export function segmentsEres(
  eras: readonly { name: string; startYear: number }[],
  domaine: Domaine,
): SegmentEre[] {
  const triees = [...eras].sort((a, b) => a.startYear - b.startYear);
  const segments: SegmentEre[] = [];
  triees.forEach((ere, i) => {
    const suivante = triees[i + 1];
    const de = Math.max(ere.startYear, domaine.min);
    const a = Math.min(suivante ? suivante.startYear : domaine.max, domaine.max);
    if (a <= de) return;
    segments.push({ nom: ere.name, gauche: pourcent(de, domaine), largeur: pourcent(a, domaine) - pourcent(de, domaine) });
  });
  return segments;
}

export interface MarquesAxe {
  points: { id: string; gauche: number }[];
  periodes: { id: string; gauche: number; largeur: number }[];
  /** Position du trait doré ; `null` sans date du jour réglée (ou hors axe, ce qui n'arrive pas : le domaine l'inclut). */
  aujourdhui: number | null;
}

export function marquesAxe(
  entrees: readonly EntreePositionnee[],
  aujourdhui: number | null,
  domaine: Domaine,
): MarquesAxe {
  const points: MarquesAxe["points"] = [];
  const periodes: MarquesAxe["periodes"] = [];
  for (const e of entrees) {
    if (e.fin === null) {
      points.push({ id: e.id, gauche: pourcent(e.debut, domaine) });
    } else {
      const a = pourcent(Math.min(e.debut, e.fin), domaine);
      const b = pourcent(Math.max(e.debut, e.fin), domaine);
      periodes.push({ id: e.id, gauche: a, largeur: b - a });
    }
  }
  return { points, periodes, aujourdhui: aujourdhui === null ? null : pourcent(aujourdhui, domaine) };
}

/** Famille de couleur d'un genre d'événement (les jetons de la charte : succès, danger, MJ, joueurs, neutre). */
export type TeinteGenre = "success" | "danger" | "gm" | "players" | "neutre";

const TEINTES: Record<TimelineEntryKind, TeinteGenre> = {
  birth: "success",
  founding: "success",
  discovery: "success",
  death: "danger",
  war: "danger",
  battle: "danger",
  disaster: "danger",
  betrayal: "gm",
  trauma: "gm",
  meeting: "players",
  oath: "players",
  custom: "neutre",
};

export function teinteGenre(kind: TimelineEntryKind): TeinteGenre {
  return TEINTES[kind];
}
