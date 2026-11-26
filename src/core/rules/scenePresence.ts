import { pieceCourante, type ScenePresence, type SceneSketch, type SceneState } from "./scene";

/**
 * V3.2-28 — Qui est avec le personnage, pièce par pièce.
 *
 * Avant ce ticket, les présents étaient une seule liste pour tout le lieu :
 * entrer dans sa chambre de l'auberge laissait l'aubergiste « présente » à
 * son chevet, pour l'écran comme pour l'IA. Ici chaque personne garde la
 * pièce où elle se tient (`room`), et seul le moteur la change : quand le
 * personnage change de pièce, avec ceux qui le suivent.
 *
 * Trois valeurs pour `room` :
 * - un nom : cette pièce du lieu ;
 * - `null` : l'espace principal du lieu (hors de toute pièce) ;
 * - absente : la personne suit le personnage. C'est l'état d'une scène écrite
 *   avant ce ticket, pour que personne ne disparaisse au déploiement ; la
 *   pièce se fige au premier changement de pièce (`changerDePiece`).
 *
 * Module PUR, comme `scene.ts`.
 */

export { pieceCourante };

function estIci(room: string | null | undefined, ici: string | null): boolean {
  return room === undefined || room === ici;
}

/** Les présents qui partagent la pièce du personnage : ce que montrent le volet Monde et le contexte de l'IA. */
export function presentsIci(scene: SceneState): ScenePresence[] {
  const ici = pieceCourante(scene);
  return scene.present.filter((p) => estIci(p.room, ici));
}

/** Les présents du lieu qui sont dans une autre pièce : l'IA les sait là, sans les faire entrer. */
export function presentsAilleurs(scene: SceneState): ScenePresence[] {
  const ici = pieceCourante(scene);
  return scene.present.filter((p) => !estIci(p.room, ici));
}

export function esquissesIci(scene: SceneState): SceneSketch[] {
  const ici = pieceCourante(scene);
  return scene.sketches.filter((s) => estIci(s.room, ici));
}

export function esquissesAilleurs(scene: SceneState): SceneSketch[] {
  const ici = pieceCourante(scene);
  return scene.sketches.filter((s) => !estIci(s.room, ici));
}

/**
 * Le personnage passe de la pièce `avant` à la pièce `apres` (`null` :
 * l'espace principal), avec `suivent` (lui-même compris, PNJ réels ou
 * esquisses). Ceux qui suivaient encore le personnage sans pièce figée
 * restent dans `avant`. Ne touche pas à `scene.room` : c'est
 * `deciderPiece` qui la tranche.
 */
export function changerDePiece(scene: SceneState, params: { avant: string | null; apres: string | null; suivent: readonly string[] }): SceneState {
  const suivent = new Set(params.suivent);
  const placer = <T extends { room?: string | null }>(qui: T, id: string): T =>
    suivent.has(id) ? { ...qui, room: params.apres } : qui.room === undefined ? { ...qui, room: params.avant } : qui;
  return {
    ...scene,
    present: scene.present.map((p) => placer(p, p.entityId)),
    sketches: scene.sketches.map((s) => placer(s, s.id)),
  };
}

/** Fait venir des présents (ou des esquisses) dans la pièce du personnage : le panneau de scène dit « qui est avec moi ». */
export function ramenerIci(scene: SceneState, ids: readonly string[]): SceneState {
  const ici = pieceCourante(scene);
  const viennent = new Set(ids);
  return {
    ...scene,
    present: scene.present.map((p) => (viennent.has(p.entityId) && !estIci(p.room, ici) ? { ...p, room: ici } : p)),
    sketches: scene.sketches.map((s) => (viennent.has(s.id) && !estIci(s.room, ici) ? { ...s, room: ici } : s)),
  };
}

/** Changer de lieu : ceux qui suivent le personnage arrivent avec lui, sans pièce. */
export function oublierLesPieces(scene: SceneState): SceneState {
  const sans = <T extends { room?: string | null }>(qui: T): T => {
    const copie = { ...qui };
    delete copie.room;
    return copie;
  };
  return { ...scene, present: scene.present.map(sans), sketches: scene.sketches.map(sans) };
}
