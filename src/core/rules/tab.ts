import type { SceneState, SceneTabLine } from "./scene";

/**
 * V3.2-11 (ADR 0110) — l'ardoise : ce que la personne qui joue doit, et où.
 *
 * Tenue par le moteur dans l'état de la scène (`SceneState.tabs`, aucune
 * migration) et indexée par lieu : changer de scène ne l'efface pas, et
 * revenir au Fanal la retrouve. Elle se remplit par « Mettre sur l'ardoise »
 * et se vide par un paiement réglé par le moteur, jamais par la narration.
 * Annuler un tour la restaure avec la scène entière.
 */

/** Au-delà, on refuse d'ajouter plutôt que d'oublier une dette ancienne. */
export const MAX_TAB_LINES = 60;

export function tabAt(scene: SceneState, locationId: string): SceneTabLine[] {
  return (scene.tabs ?? []).filter((line) => line.locationId === locationId);
}

export function tabTotalCp(lines: readonly SceneTabLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceCp, 0);
}

/** Ajoute une ligne due au lieu de la scène ; `null` si l'ardoise est pleine. */
export function addToTab(scene: SceneState, line: Omit<SceneTabLine, "locationId">): SceneState | null {
  const tabs = scene.tabs ?? [];
  if (tabs.length >= MAX_TAB_LINES) return null;
  return { ...scene, tabs: [...tabs, { locationId: scene.locationId, ...line }] };
}

/** Solde l'ardoise d'un lieu : un paiement règle tout ce qui y est dû. */
export function clearTabAt(scene: SceneState, locationId: string): SceneState {
  return { ...scene, tabs: (scene.tabs ?? []).filter((line) => line.locationId !== locationId) };
}
