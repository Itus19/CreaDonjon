/**
 * V3.1-67 — noyau pur du bloc Image : ce que chaque contrôle de la barre
 * flottante et du choix de fond écrit dans la donnée. Le composant ne fait
 * que brancher ; la correspondance contrôle → champ se décide ici.
 *
 * Aucune de ces fonctions n'est appelée à l'ouverture d'un bloc : un bloc
 * ancien s'affiche tel quel, rien n'est réécrit tant qu'on ne touche à rien.
 */

import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import {
  backgroundModeOf,
  withBackgroundMode,
  type ImageBackgroundMode,
} from "@/src/core/images/backgroundMode";

export const TAILLE_MIN = 50;
export const TAILLE_MAX = 200;
export const TAILLE_PAS = 10;

/** Le cran de taille suivant (+1) ou précédent (-1), toujours sur un multiple de 10 et dans 50-200 (une valeur ancienne hors grille, comme 105, rejoint la grille). */
export function tailleSuivante(sizePct: number, sens: 1 | -1): number {
  const cran =
    sens === 1
      ? Math.floor(sizePct / TAILLE_PAS) * TAILLE_PAS + TAILLE_PAS
      : Math.ceil(sizePct / TAILLE_PAS) * TAILLE_PAS - TAILLE_PAS;
  return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, cran));
}

/** Le texte contourne l'image : seulement pour une image posée dans un bloc de texte, et sauf si elle le coupe. */
export function estContourne(data: Pick<ImageBlockData, "anchorFlow">, ancree: boolean): boolean {
  return ancree && data.anchorFlow !== "break";
}

export type ControleBarre =
  | { controle: "align"; valeur: ImageBlockData["align"] }
  | { controle: "taille"; sens: 1 | -1 }
  | { controle: "contourne" };

/**
 * Applique un contrôle de la barre flottante.
 *
 * - Gauche / Centre / Droite écrit `align`. Un flottement centré n'existe pas
 *   en CSS : choisir « Centre » pour une image dont le texte contourne la
 *   fait donc couper le texte (`anchorFlow: "break"`) ;
 * - « − » / « + » écrit `sizePct`, de 10 en 10 ;
 * - « Le texte contourne » écrit `anchorFlow` (`float` / `break`). L'allumer
 *   sur une image centrée la passe à gauche, pour la même raison. Sans
 *   ancrage, il ne fait rien (le bouton est alors désactivé).
 */
export function appliquerControle(data: ImageBlockData, action: ControleBarre, ancree: boolean): ImageBlockData {
  switch (action.controle) {
    case "align":
      if (action.valeur === "center" && estContourne(data, ancree)) {
        return { ...data, align: "center", anchorFlow: "break" };
      }
      return { ...data, align: action.valeur };
    case "taille":
      return { ...data, sizePct: tailleSuivante(data.sizePct, action.sens) };
    case "contourne":
      if (!ancree) return data;
      if (estContourne(data, ancree)) return { ...data, anchorFlow: "break" };
      return { ...data, anchorFlow: "float", align: data.align === "center" ? "left" : data.align };
  }
}

/** Les trois choix de fond de la page du wiki, dans l'ordre affiché. */
export const CHOIX_FOND: readonly ImageBackgroundMode[] = ["none", "also", "only"];

/** Le choix de fond d'un bloc existant (lecture inverse des deux booléens). */
export function fondDe(data: ImageBlockData): ImageBackgroundMode {
  return backgroundModeOf(data);
}

/** Écrit la paire `useAsWikiBackground` / `alsoShowInFlow` du choix. */
export function appliquerFond(data: ImageBlockData, mode: ImageBackgroundMode): ImageBlockData {
  return { ...data, ...withBackgroundMode(mode) };
}

/** Flou et fondu n'ont de sens que si un fond est choisi. */
export function reglagesFondVisibles(mode: ImageBackgroundMode): boolean {
  return mode !== "none";
}
