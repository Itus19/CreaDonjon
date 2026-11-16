/**
 * V3.1-67 — noyau pur du bloc Image : le pas de taille et le choix de fond.
 * Le composant ne fait que brancher ; la correspondance contrôle → champ se
 * décide ici. V3.1-189 : la barre flottante du bloc image a disparu (les
 * réglages d'habillage vivent dans la bulle de l'éditeur de texte,
 * `InlineImage.tsx`) ; `tailleSuivante` y sert toujours.
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
