/**
 * V3.1-71 — noyau pur du bloc Relation (A) : quels axes montrer, le
 * « pourquoi » d'une perle, la ligne du journal, la portion colorée d'un fil.
 * Le composant ne fait que dessiner.
 */

import { RELATIONSHIP_AXIS_KEYS, type RelationshipAxisKey } from "@/src/core/psyche/keys";
import type { GameDate } from "@/src/core/calendar/types";
import { relationshipSummary } from "@/src/core/psyche/bands";

/** Les genres de fiche qui sont des personnes : seuls eux ont une Attirance. */
const GENRES_PERSONNE: readonly string[] = ["character"];

/**
 * Les axes montrés selon le genre de la cible. Une cible qui n'est pas une
 * personne (faction, lieu, créature…) ne suscite pas d'Attirance : l'axe est
 * masqué, jamais mis à zéro.
 */
export function axesAffiches(genreCible: string | null | undefined): RelationshipAxisKey[] {
  const personne = genreCible !== null && genreCible !== undefined && GENRES_PERSONNE.includes(genreCible);
  return RELATIONSHIP_AXIS_KEYS.filter((axe) => personne || axe !== "attraction_repulsion");
}

/** Un souvenir tel que l'API de la paire le rend. */
export interface SouvenirDePaire {
  id: string;
  summary: string;
  deltas: Partial<Record<string, number>>;
  occurred_at_ingame: GameDate | null;
  created_at: string;
}

export interface SouvenirDAxe {
  id: string;
  summary: string;
  delta: number;
  occurredAtIngame: GameDate | null;
  createdAt: string;
}

/**
 * Les deux derniers souvenirs qui ont touché cet axe (liste du plus récent au
 * plus ancien, comme l'API), avec l'écart brut qu'ils lui ont donné. Un
 * souvenir qui n'a pas touché l'axe, ou à 0, ne compte pas.
 */
export function deuxDerniersSouvenirs(souvenirs: readonly SouvenirDePaire[], axe: string): SouvenirDAxe[] {
  const trouves: SouvenirDAxe[] = [];
  for (const s of souvenirs) {
    const delta = s.deltas[axe];
    if (delta === undefined || delta === 0) continue;
    trouves.push({ id: s.id, summary: s.summary, delta, occurredAtIngame: s.occurred_at_ingame, createdAt: s.created_at });
    if (trouves.length === 2) break;
  }
  return trouves;
}

/** Une date en jeu lue dans du JSON brut : seulement si elle a bien la forme d'une `GameDate`. */
export function dateEnJeuValide(valeur: unknown): GameDate | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const v = valeur as Record<string, unknown>;
  return typeof v.year === "number" && typeof v.precision === "string" ? (valeur as GameDate) : null;
}

export type LigneJournal =
  | { cle: "aucun" }
  | { cle: "dernier"; n: number; date: string };

/**
 * « 5 souvenirs au journal · le dernier le 7 oct. 1492 ». Le nombre vient du
 * serveur (compté, jamais stocké). La date en jeu passe par le calendrier du
 * monde quand le dernier souvenir en a une ; sinon sa date réelle.
 */
export function ligneJournal(
  souvenirs: { count: number; last: { occurredAtIngame: unknown; createdAt: string } | null },
  formaterDateEnJeu: (date: GameDate) => string,
  formaterDateReelle: (iso: string) => string,
): LigneJournal {
  if (souvenirs.count === 0 || !souvenirs.last) return { cle: "aucun" };
  const enJeu = dateEnJeuValide(souvenirs.last.occurredAtIngame);
  return {
    cle: "dernier",
    n: souvenirs.count,
    date: enJeu ? formaterDateEnJeu(enJeu) : formaterDateReelle(souvenirs.last.createdAt),
  };
}

export interface PortionFil {
  /** Côté du milieu où la portion s'étend ; `null` au neutre (rien à colorer). */
  cote: "gauche" | "droite" | null;
  couleur: "success" | "danger" | null;
  /** Bord gauche de la portion et sa largeur, en pour cent de la largeur du fil. */
  debut: number;
  largeur: number;
}

/**
 * La portion colorée entre le milieu du fil et la perle : verte si positive
 * (vers l'autre portrait, à droite), rouge si négative (à gauche).
 */
export function portionFil(valeur: number): PortionFil {
  if (valeur === 0) return { cote: null, couleur: null, debut: 50, largeur: 0 };
  return valeur > 0
    ? { cote: "droite", couleur: "success", debut: 50, largeur: valeur / 2 }
    : { cote: "gauche", couleur: "danger", debut: 50 + valeur / 2, largeur: -valeur / 2 };
}

/** Où se pose le centre de la perle : la vraie position, mais jamais si près d'un bord que le mot qu'elle porte en déborde. */
export function positionPerle(valeur: number): number {
  return Math.min(88, Math.max(12, (valeur + 100) / 2));
}

/** Le prénom seul (téléphone) : le premier mot du nom ; un nom d'un seul mot reste entier. */
export function prenom(nom: string): string {
  const mot = nom.trim().split(/\s+/)[0];
  return mot ?? "";
}

/**
 * Le résumé du milieu : les valeurs enregistrées, recouvertes par celles de la
 * perle en cours de glissement (`live`), pour les seuls axes affichés — il suit
 * donc le doigt avant même l'enregistrement.
 */
export function resumeEnDirect(
  axes: Partial<Record<RelationshipAxisKey, number>>,
  live: Partial<Record<RelationshipAxisKey, number>>,
  affiches: readonly RelationshipAxisKey[],
): string {
  const valeurs: Partial<Record<RelationshipAxisKey, number>> = {};
  for (const axe of affiches) {
    const v = live[axe] ?? axes[axe];
    if (v !== undefined) valeurs[axe] = v;
  }
  return relationshipSummary(valeurs);
}
