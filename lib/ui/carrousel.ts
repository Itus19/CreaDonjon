import type { ChooseStart } from "@/src/core/campaigns/claimable";

/**
 * Carrousel « Choisis ton personnage » (V3.1-82) : logique pure.
 * Les cartes sont les PJ du serveur, puis « Nouveau personnage » en dernière
 * carte ; la liste boucle. Rien n'est filtré ici (le serveur l'a fait).
 */

/** Un glissé plus court que ce seuil (px) n'est pas un geste de changement de carte. */
export const SEUIL_GLISSE = 40;

/** L'index de la carte sur laquelle on s'ouvre. `ids` : les PJ, dans l'ordre ; « Nouveau » est à l'index `ids.length`. */
export function indexDepart(startOn: ChooseStart, ids: readonly string[]): number {
  if (startOn.kind === "character") {
    const index = ids.indexOf(startOn.entityId);
    if (index >= 0) return index;
  }
  return ids.length;
}

export function indexSuivant(courant: number, total: number): number {
  return (courant + 1) % total;
}

export function indexPrecedent(courant: number, total: number): number {
  return (courant - 1 + total) % total;
}

/** Le décalage signé de la carte `index` par rapport à la carte centrée, par le chemin le plus court (la liste boucle). */
export function decalage(index: number, courant: number, total: number): number {
  let d = (((index - courant) % total) + total) % total;
  if (d > total / 2) d -= total;
  return d;
}

export type RolePosition = "centre" | "voisine" | "masquee";

export function rolePosition(d: number): RolePosition {
  if (d === 0) return "centre";
  return Math.abs(d) === 1 ? "voisine" : "masquee";
}

/** Le prénom : le premier mot du nom. */
export function prenom(nom: string): string {
  return nom.trim().split(/\s+/)[0] ?? "";
}

/** `1` : carte suivante, `-1` : précédente, `0` : trop court pour compter. `dx` : déplacement horizontal du doigt. */
export function directionGlisse(dx: number): -1 | 0 | 1 {
  if (dx <= -SEUIL_GLISSE) return 1;
  if (dx >= SEUIL_GLISSE) return -1;
  return 0;
}
