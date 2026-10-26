/**
 * V3.1-77 — noyau pur du bloc Musique (A) : lire et écrire « m:ss », valider
 * les bornes et un lien avec le schéma (jamais recopié ici), les pas-à-pas de
 * fondu, ce que chaque service permet, le texte des bornes, le rangement.
 */

import { zMusicBlockData, type MusicTrack } from "@/src/core/schemas/blocks/music";
import { detectProvider, youtubeVideoId, type MusicProvider } from "@/src/core/music/embedUrl";

/** `m:ss`, `h:mm:ss` ou des secondes seules ; `""` = absent (la borne n'existe pas). */
export type LectureTemps = { ok: true; secondes: number | undefined } | { ok: false };

/** « 0:12 » donne 12 ; vide donne « absent » ; une saisie qui n'est pas un temps est refusée. */
export function lireTemps(saisie: string): LectureTemps {
  const brut = saisie.trim();
  if (brut === "") return { ok: true, secondes: undefined };
  if (!/^\d+(:\d{1,2}){0,2}$/.test(brut)) return { ok: false };
  const parties = brut.split(":").map(Number);
  // Après le premier groupe, minutes et secondes tiennent sur 0-59.
  if (parties.slice(1).some((p) => p > 59)) return { ok: false };
  const secondes = parties.reduce((total, p) => total * 60 + p, 0);
  return { ok: true, secondes };
}

/** 72 donne « 1:12 », 3600 donne « 1:00:00 », absent donne « ». */
export function ecrireTemps(secondes: number | undefined): string {
  if (secondes === undefined) return "";
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export type Validation = { ok: true } | { ok: false; message: string };

const schemaPiste = zMusicBlockData.shape.tracks.element;

/** Valide une piste avec le schéma du bloc : « La fin doit venir après le début. », plafond de 24 h… Le message est celui du schéma. */
export function validerPiste(piste: MusicTrack): Validation {
  const r = schemaPiste.safeParse(piste);
  return r.success ? { ok: true } : { ok: false, message: r.error.issues[0]?.message ?? "Piste invalide." };
}

/** Un lien à ajouter : même refus que le schéma (« Lien non reconnu — seuls Spotify, SoundCloud et YouTube sont acceptés. »). */
export function validerLien(url: string): Validation {
  return validerPiste({ id: "nouvelle-piste", url: url.trim() });
}

export const FONDU_MIN_MS = 0;
export const FONDU_MAX_MS = 5000;
export const FONDU_PAS_MS = 500;
export const FONDU_PAR_DEFAUT_MS = 1500;

/** Un cran de plus ou de moins sur un fondu : de 0,5 s en 0,5 s, jamais en dehors de 0 à 5 s. */
export function pasFondu(ms: number, sens: 1 | -1): number {
  const cran = sens === 1 ? Math.floor(ms / FONDU_PAS_MS) * FONDU_PAS_MS + FONDU_PAS_MS : Math.ceil(ms / FONDU_PAS_MS) * FONDU_PAS_MS - FONDU_PAS_MS;
  return Math.min(FONDU_MAX_MS, Math.max(FONDU_MIN_MS, cran));
}

/** « 1,5 s » (virgule française), « 2 s », « 0 s ». */
export function formaterFondu(ms: number): string {
  const secondes = ms / 1000;
  return `${Number.isInteger(secondes) ? secondes : String(secondes).replace(".", ",")} s`;
}

export interface Capacites {
  service: MusicProvider | null;
  /** Début et fin précis : YouTube seulement (ADR 0022). */
  bornes: boolean;
  /** Fondus, enchaînement et boucle : YouTube seulement. */
  fondus: boolean;
}

/** Ce que le service d'un lien permet. Seul l'API de YouTube pilote le volume, les bornes et la fin de piste. */
export function capacites(url: string): Capacites {
  const pilotable = youtubeVideoId(url) !== null;
  return { service: detectProvider(url), bornes: pilotable, fondus: pilotable };
}

/** « 0:12 → fin », « début → 1:30 », « 0:12 → 1:30 » ; `null` pour une piste entière. */
export function texteBornes(debut: number | undefined, fin: number | undefined, mots: { debut: string; fin: string }): string | null {
  if (debut === undefined && fin === undefined) return null;
  return `${debut === undefined ? mots.debut : ecrireTemps(debut)} → ${fin === undefined ? mots.fin : ecrireTemps(fin)}`;
}

/** Déplace une piste de `de` à `vers` (les autres se décalent) ; hors bornes ou sans effet, la liste est rendue telle quelle. */
export function deplacerPiste<T>(pistes: readonly T[], de: number, vers: number): T[] {
  if (de === vers || de < 0 || vers < 0 || de >= pistes.length || vers >= pistes.length) return [...pistes];
  const suite = [...pistes];
  const [piste] = suite.splice(de, 1);
  suite.splice(vers, 0, piste);
  return suite;
}

export type NoteFondus = { cle: "fondus"; entrant: string; sortant: string } | { cle: "aucun"; service: MusicProvider | null };

/** Ce que la platine dit des fondus pour la piste affichée. */
export function noteFondus(url: string, entrantMs: number, sortantMs: number): NoteFondus {
  const c = capacites(url);
  if (!c.fondus) return { cle: "aucun", service: c.service };
  return { cle: "fondus", entrant: formaterFondu(entrantMs), sortant: formaterFondu(sortantMs) };
}
