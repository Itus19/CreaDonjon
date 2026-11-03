import { yearPosition } from "@/src/core/calendar/axisPosition";
import type { CalendarConfig, CalendarEra } from "@/src/core/calendar/types";
import type { TimelineEntryKind, TimelineScope } from "@/src/core/schemas/blocks/timeline";
import { clampSpan, MIN_SPAN, VIEW_MARGIN, type TimelinePoint, type View, type WorldExtent } from "@/src/core/timeline/view";
import type { WorldTimelineEntry } from "@/src/server/services/timeline";

/**
 * La frise horizontale de la Chronologie (V3.1-98) : la présentation pure.
 * Tout le calcul d'échelle est dans `src/core/timeline/view.ts` (V3.1-97) ;
 * ici, seulement ce que l'écran en fait : points, filtres, gestes, ères.
 */

/* ----------------------------------------------------------------- points */

/** Une date de la frise = une entrée du flux ; son identifiant est son rang dans le flux (unique, stable le temps d'un rendu). */
export function pointsDeFrise(entries: readonly WorldTimelineEntry[], calendar: CalendarConfig): TimelinePoint[] {
  return entries.map((e, i) => ({ id: String(i), year: yearPosition(e.entry.date, calendar), scope: e.scope }));
}

/* ---------------------------------------------------------------- filtres */

export type FiltresFrise = {
  /** `null` : tous les genres. */
  genre: TimelineEntryKind | null;
  /** `null` : toutes les fiches ; sinon l'id de la fiche d'où vient la date. */
  fiche: string | null;
  recherche: string;
};

export const FILTRES_VIERGES: FiltresFrise = { genre: null, fiche: null, recherche: "" };

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Genre, fiche source et recherche (titre, résumé, nom de la fiche) ; l'ordre du flux est gardé. */
export function filtrerEntrees(entries: readonly WorldTimelineEntry[], filtres: FiltresFrise): WorldTimelineEntry[] {
  const mot = normaliser(filtres.recherche.trim());
  return entries.filter((e) => {
    if (filtres.genre !== null && e.entry.kind !== filtres.genre) return false;
    if (filtres.fiche !== null && e.sourceEntityId !== filtres.fiche) return false;
    if (mot === "") return true;
    return normaliser(`${e.entry.title} ${e.entry.summary} ${e.sourceEntityName}`).includes(mot);
  });
}

/** Les fiches d'où viennent des dates, par nom, sans doublon (le menu « par fiche »). */
export function fichesDuFlux(entries: readonly WorldTimelineEntry[]): { id: string; nom: string }[] {
  const vues = new Map<string, string>();
  for (const e of entries) if (e.source.kind !== "world") vues.set(e.sourceEntityId, e.sourceEntityName);
  return [...vues].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** Les fiches où l'on peut ajouter un événement : celles qui portent déjà un bloc Chronologie (naissances et morts exclues). */
export function fichesAvecChronologie(entries: readonly WorldTimelineEntry[]): { id: string; nom: string }[] {
  const vues = new Map<string, string>();
  for (const e of entries) if (e.source.kind === "entity") vues.set(e.sourceEntityId, e.sourceEntityName);
  return [...vues].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/* ------------------------------------------------------------------ cartes */

/** Monde → Région → Détail → Monde (V3.1-96). */
export function porteeSuivante(portee: TimelineScope): TimelineScope {
  return portee === "major" ? "notable" : portee === "notable" ? "detail" : "major";
}

/** Une entrée dont la portée, la promotion et la visibilité s'écrivent : celle d'un bloc `timeline` (pas une naissance ni une mort). */
export function estModifiable(e: WorldTimelineEntry): boolean {
  return e.block !== null;
}

/** « → en faire une fiche » : seulement pour une entrée d'un bloc qui n'est pas déjà une fiche. */
export function peutFaireFiche(e: WorldTimelineEntry): boolean {
  return e.block !== null && e.refEntitySlug === null;
}

/* -------------------------------------------------------------------- vue */

/** Vue de départ : un siècle autour d'aujourd'hui s'il est réglé, sinon tout le monde. */
export function vueInitiale(world: WorldExtent, todayYear: number | null): View {
  const span = clampSpan(130, world.end - world.start);
  if (todayYear === null) return { center: (world.start + world.end) / 2, span: clampSpan(world.end - world.start, world.end - world.start) };
  return { span, center: Math.max(world.start, Math.min(todayYear + span / 4, world.end)) };
}

/** « + n autour » : une vue qui tient la plage de dates rattachées, avec une marge (jamais sous 20 ans). */
export function vueSurPlage(plage: { start: number; end: number }, world: WorldExtent): View {
  const etendue = Math.max(plage.end - plage.start, 0) * 1.5;
  return {
    center: Math.max(world.start, Math.min((plage.start + plage.end) / 2, world.end)),
    span: clampSpan(Math.max(etendue, MIN_SPAN), world.end - world.start),
  };
}

/* ----------------------------------------------------------------- gestes */

/** Molette : Ctrl (ou pincer sur un pavé tactile, que le navigateur rapporte avec Ctrl) zoome, sinon défile. `null` : pas de mouvement. */
export function gesteMolette(evt: { deltaX: number; deltaY: number; ctrlKey: boolean }):
  | { type: "zoom"; sens: "in" | "out" }
  | { type: "defiler"; sens: 1 | -1 }
  | null {
  if (evt.ctrlKey) {
    if (evt.deltaY === 0) return null;
    return { type: "zoom", sens: evt.deltaY > 0 ? "out" : "in" };
  }
  const delta = Math.abs(evt.deltaX) > Math.abs(evt.deltaY) ? evt.deltaX : evt.deltaY;
  if (delta === 0) return null;
  return { type: "defiler", sens: delta > 0 ? 1 : -1 };
}

/** Glisser de `dx` px vers la droite : la frise suit le doigt, le centre recule d'autant d'années. */
export function centreApresGlisser(centreDepart: number, dx: number, span: number, largeur: number): number {
  const utile = largeur - 2 * VIEW_MARGIN;
  return utile <= 0 ? centreDepart : centreDepart - (dx / utile) * span;
}

/** Pincer : doigts qui s'écartent (distance qui croît) = zoom avant (étendue qui décroît). `null` si une distance est nulle. */
export function facteurPincement(distanceAvant: number, distanceApres: number): number | null {
  if (distanceAvant <= 0 || distanceApres <= 0) return null;
  return distanceAvant / distanceApres;
}

/** Au-delà de cette distance (px), un appui qui bouge devient un glisser et non un toucher. */
export const SEUIL_GLISSER = 4;

/* -------------------------------------------------------------------- ères */

/** « de l'an X à l'an Y » : une ère dure jusqu'à la suivante, la dernière jusqu'à aujourd'hui (`fin` nul sans jour actuel). */
export function plageEre(eras: readonly CalendarEra[], index: number, todayYear: number | null): { debut: number; fin: number | null } {
  const era = eras[index];
  const apres = eras.map((e) => e.startYear).filter((a) => a > era.startYear);
  if (apres.length > 0) return { debut: era.startYear, fin: Math.min(...apres) };
  return { debut: era.startYear, fin: todayYear === null || todayYear < era.startYear ? null : Math.floor(todayYear) };
}

/** Le teint d'un bandeau d'ère, en tournant : les classes sont écrites en entier pour que Tailwind les voie. */
export const TEINTES_ERES = ["bg-accent/15", "bg-players/15", "bg-gm/15", "bg-success/15"] as const;

export function teinteEre(rang: number): string {
  return TEINTES_ERES[((rang % TEINTES_ERES.length) + TEINTES_ERES.length) % TEINTES_ERES.length];
}

/** Valeur du paramètre d'URL `?vue=` : seule « joueurs » compte (le serveur refuse tout autre que le MJ). */
export function estVueJoueurs(param: string | string[] | undefined): boolean {
  return param === "joueurs";
}
