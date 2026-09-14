/**
 * V2.1-6, lot 2 (docs/adr/0022-lecteur-youtube-pilote.md) — la rampe de volume
 * d'un fondu, en fonction pure.
 *
 * L'API YouTube ne connait que `setVolume(0-100)` : un fondu est donc une
 * suite d'appels espaces dans le temps, pas une transition declaree. Le
 * lecteur se contente de battre la mesure (`setInterval`) et d'appliquer ce
 * que cette fonction lui dit — c'est ce qui permet d'eprouver la partie
 * calculatoire sans navigateur, sans reseau et sans attendre la duree reelle
 * du fondu.
 */

/**
 * Intervalle entre deux paliers. 50 ms : en dessous, on multiplie les appels
 * a une iframe d'un autre domaine sans qu'aucune oreille n'y gagne ; au-dessus,
 * un fondu court (300 ms) n'aurait plus assez de marches pour s'entendre comme
 * un fondu plutot que comme un escalier.
 */
export const FADE_STEP_MS = 50;

/** Nombre de paliers d'un fondu de cette duree. `0` quand le fondu est desactive. */
export function fadeStepCount(durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.ceil(durationMs / FADE_STEP_MS);
}

/**
 * Volume a appliquer apres `elapsedMs` d'un fondu de `durationMs` allant de
 * `from` a `to` (tous deux 0-100).
 *
 * Progression lineaire : l'oreille percoit le volume de facon logarithmique,
 * donc une rampe lineaire monte un peu vite au debut. On ne complique pas tant
 * qu'on n'a pas entendu que ca gene — la regle des trois vaut aussi pour les
 * courbes.
 *
 * Borne aux deux extremites : un temps negatif (horloge qui recule, onglet
 * remis au premier plan) ou superieur a la duree ne doit jamais produire un
 * volume hors de 0-100, que `setVolume` accepterait sans rien dire. Duree
 * nulle : saute directement a l'arrivee, jamais une division par zero.
 */
export function fadeVolumeAt(elapsedMs: number, durationMs: number, from: number, to: number): number {
  if (durationMs <= 0) return Math.round(to);
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return Math.round(from + (to - from) * progress);
}
