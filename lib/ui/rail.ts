/**
 * Règles pures du rail repliable (V3.1-27), isolées du composant pour pouvoir
 * les tester sans navigateur.
 */

/** Clé `localStorage` de l'état replié du rail (commune aux quatre rails). */
export const CLE_RAIL_REPLIE = "creadonjon:rail:replie";

/**
 * Lit la valeur mémorisée : seule la chaîne "1" veut dire « replié ». Tout le
 * reste (absence, chaîne vide, valeur d'une version future) donne « déplié » :
 * en cas de doute, on montre les libellés plutôt que de cacher la navigation.
 */
export function lireRailReplie(valeur: string | null): boolean {
  return valeur === "1";
}

/** Valeur à écrire dans `localStorage` pour un état donné (réciproque de `lireRailReplie`). */
export function ecrireRailReplie(replie: boolean): string {
  return replie ? "1" : "0";
}
