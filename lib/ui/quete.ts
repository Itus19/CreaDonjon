/**
 * V3.1-76 — noyau pur de la Quête (C) : la progression et l'anneau, « Prochain »,
 * la couleur de chaque état, et les objectifs tels qu'on les voit avant que le
 * serveur ait répondu. Le composant ne fait que dessiner.
 */

import type { QuestState } from "@/src/core/schemas/blocks/quest";

interface ObjectifSimple {
  id: string;
  text: string;
  done: boolean;
}

export interface Progression {
  atteints: number;
  total: number;
  /** Part atteinte, de 0 à 1 (0 sans objectif). */
  fraction: number;
  /** Angle parcouru par l'anneau, de 0 à 360 degrés. */
  angle: number;
  complet: boolean;
}

/** Les objectifs atteints sur le total : « 2 / 4 », la part et l'angle de l'anneau. */
export function progression(objectifs: readonly Pick<ObjectifSimple, "done">[]): Progression {
  const total = objectifs.length;
  const atteints = objectifs.filter((o) => o.done).length;
  const fraction = total === 0 ? 0 : atteints / total;
  return { atteints, total, fraction, angle: fraction * 360, complet: total > 0 && atteints === total };
}

/** Le tracé d'un anneau de rayon `rayon` rempli à `fraction` (trait en pointillé : une longueur tracée, le reste vide). */
export function anneau(fraction: number, rayon: number): { circonference: number; trace: number } {
  const circonference = 2 * Math.PI * rayon;
  return { circonference, trace: circonference * Math.min(1, Math.max(0, fraction)) };
}

export type Prochain = { cle: "aucun" } | { cle: "suivant"; texte: string } | { cle: "tous" };

/**
 * « Prochain : » le premier objectif non atteint (dans l'ordre de la liste) ;
 * « Tous les objectifs sont atteints » s'il n'y en a plus ; `aucun` quand la
 * quête n'a pas d'objectif du tout.
 */
export function prochain(objectifs: readonly ObjectifSimple[]): Prochain {
  if (objectifs.length === 0) return { cle: "aucun" };
  const suivant = objectifs.find((o) => !o.done);
  return suivant ? { cle: "suivant", texte: suivant.text } : { cle: "tous" };
}

/** La famille de couleur de chaque état (jetons de la charte : ambre, vert, rouge ; neutre sinon). */
export type TeinteEtat = "accent" | "success" | "danger" | "muted";

const TEINTES: Record<QuestState, TeinteEtat> = {
  not_started: "muted",
  in_progress: "accent",
  succeeded: "success",
  failed: "danger",
  abandoned: "muted",
};

export function teinteEtat(etat: QuestState): TeinteEtat {
  return TEINTES[etat];
}

/**
 * Les objectifs vus avec les cases cochées PAS ENCORE confirmées par le
 * serveur : l'anneau et « Prochain » suivent le toucher tout de suite, sans
 * attendre l'aller-retour. `optimiste` : id d'objectif -> valeur de `done`.
 */
export function objectifsAffiches<T extends ObjectifSimple>(objectifs: readonly T[], optimiste: Readonly<Record<string, boolean>>): T[] {
  return objectifs.map((o) => (Object.hasOwn(optimiste, o.id) ? { ...o, done: optimiste[o.id] } : o));
}
