/**
 * V3.1-73 — noyau pur de l'arbre généalogique (B) : le gabarit des cartes,
 * les traits arrondis (le couple relié à l'horizontale, les enfants qui
 * descendent du milieu du couple par des coudes), la case « + enfant », la
 * ligne de dates et le recentrage de la vue. Le composant ne fait que dessiner.
 */

import { ageWithDeath } from "@/src/core/genealogy/lifeDates";
import type { GameDate } from "@/src/core/calendar/types";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";

export interface Gabarit {
  largeur: number;
  hauteur: number;
  ecartCol: number;
  ecartLig: number;
  /** Rayon des coudes des traits. */
  rayon: number;
}

/** Ordinateur : cartes de 100 × 130. */
export const GABARIT_LARGE: Gabarit = { largeur: 100, hauteur: 130, ecartCol: 70, ecartLig: 90, rayon: 14 };
/** Téléphone : cartes de 66 × 88. */
export const GABARIT_ETROIT: Gabarit = { largeur: 66, hauteur: 88, ecartCol: 44, ecartLig: 64, rayon: 10 };

/** Sous cette largeur de bloc (28 rem), on passe au gabarit du téléphone — le même seuil que `@md/bloc`. */
export const LARGEUR_ETROITE_PX = 448;

export function gabaritPour(largeurConteneur: number): Gabarit {
  return largeurConteneur > 0 && largeurConteneur < LARGEUR_ETROITE_PX ? GABARIT_ETROIT : GABARIT_LARGE;
}

type Place = Pick<FamilyTreeNode, "order" | "generation">;

/** Coin haut-gauche d'une carte. */
export function position(node: Place, minGeneration: number, g: Gabarit): { x: number; y: number } {
  return {
    x: node.order * (g.largeur + g.ecartCol),
    y: (node.generation - minGeneration) * (g.hauteur + g.ecartLig),
  };
}

export function dimensions(tree: Pick<FamilyTree, "nodes" | "minGeneration">, g: Gabarit): { largeur: number; hauteur: number } {
  if (tree.nodes.length === 0) return { largeur: 0, hauteur: 0 };
  const places = tree.nodes.map((n) => position(n, tree.minGeneration, g));
  return {
    largeur: Math.max(...places.map((p) => p.x)) + g.largeur,
    hauteur: Math.max(...places.map((p) => p.y)) + g.hauteur,
  };
}

/**
 * Un parent descend vers un enfant par un coude arrondi : tout droit depuis
 * (x1, y1) jusqu'à la hauteur du « bus » `busY`, horizontalement jusqu'au-dessus
 * de l'enfant, puis tout droit jusqu'à (x2, y2). Les deux coins sont arrondis
 * (courbe de Bézier quadratique) ; le rayon se réduit quand il manque de place.
 */
export function coude(x1: number, y1: number, x2: number, y2: number, busY: number, rayon: number): string {
  if (x1 === x2) return `M${x1} ${y1} V${y2}`;
  const sens = x2 > x1 ? 1 : -1;
  const r = Math.max(0, Math.min(rayon, Math.abs(x2 - x1) / 2, busY - y1, y2 - busY));
  return `M${x1} ${y1} V${busY - r} Q${x1} ${busY} ${x1 + sens * r} ${busY} H${x2 - sens * r} Q${x2} ${busY} ${x2} ${busY + r} V${y2}`;
}

export interface Trait {
  edgeId: string;
  /** Chemin SVG. */
  d: string;
  /** Ex-partenaire : pointillé orange. */
  ex: boolean;
  kind: FamilyTreeEdge["kind"];
  /** Où poser l'étiquette du lien : au milieu du trait (sur le bus pour un parent-enfant). */
  milieu: { x: number; y: number };
}

/**
 * Les traits de l'arbre, un par lien. Couple et fratrie : un trait horizontal
 * à mi-hauteur des cartes. Parent-enfant : depuis le MILIEU du couple si
 * l'enfant a deux parents reliés entre eux (ou depuis le bas du parent sinon),
 * par un coude arrondi vers le haut de l'enfant ; les enfants d'un même couple
 * partagent donc la même descente et le même bus.
 */
export function traits(tree: FamilyTree, g: Gabarit): Trait[] {
  const places = new Map(tree.nodes.map((n) => [n.id, position(n, tree.minGeneration, g)]));
  const parentsDe = new Map<string, string[]>();
  for (const e of tree.edges) {
    if (e.kind !== "parent-child") continue;
    parentsDe.set(e.toId, [...(parentsDe.get(e.toId) ?? []), e.fromId]);
  }
  const reliesEntreEux = (a: string, b: string) =>
    tree.edges.some((e) => e.kind === "partner" && ((e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a)));

  const resultat: Trait[] = [];
  for (const edge of tree.edges) {
    const de = places.get(edge.fromId);
    const vers = places.get(edge.toId);
    if (!de || !vers) continue;
    const ex = edge.ex === true;
    if (edge.kind !== "parent-child") {
      const y = de.y + g.hauteur / 2;
      const xa = de.x + g.largeur / 2;
      const xb = vers.x + g.largeur / 2;
      resultat.push({ edgeId: edge.id, d: `M${xa} ${y} H${xb}`, ex, kind: edge.kind, milieu: { x: (xa + xb) / 2, y } });
      continue;
    }
    const conjoint = (parentsDe.get(edge.toId) ?? []).find((p) => p !== edge.fromId && reliesEntreEux(edge.fromId, p));
    const conjointPlace = conjoint ? places.get(conjoint) : undefined;
    const enCouple = conjointPlace !== undefined && conjointPlace.y === de.y;
    const x1 = enCouple ? (de.x + conjointPlace.x) / 2 + g.largeur / 2 : de.x + g.largeur / 2;
    const y1 = enCouple ? de.y + g.hauteur / 2 : de.y + g.hauteur;
    const x2 = vers.x + g.largeur / 2;
    const busY = de.y + g.hauteur + g.ecartLig / 2;
    resultat.push({ edgeId: edge.id, d: coude(x1, y1, x2, vers.y, busY, g.rayon), ex, kind: edge.kind, milieu: { x: (x1 + x2) / 2, y: busY } });
  }
  return resultat;
}

export interface CaseEnfant {
  /** Le lien de couple sous lequel la case attend. */
  edgeId: string;
  parentA: string;
  parentB: string;
  /** Coin haut-gauche de la case. */
  x: number;
  y: number;
}

/**
 * La case pointillée « + enfant » sous un COUPLE sans enfant (lien de couple
 * actuel, pas un ex) dont aucun des deux n'a d'enfant dans l'arbre. Elle se
 * pose une génération plus bas, centrée sous le couple.
 */
export function casesEnfant(tree: FamilyTree, g: Gabarit): CaseEnfant[] {
  const parents = new Set(tree.edges.filter((e) => e.kind === "parent-child").map((e) => e.fromId));
  const places = new Map(tree.nodes.map((n) => [n.id, position(n, tree.minGeneration, g)]));
  const cases: CaseEnfant[] = [];
  for (const e of tree.edges) {
    if (e.kind !== "partner" || e.ex) continue;
    if (parents.has(e.fromId) || parents.has(e.toId)) continue;
    const a = places.get(e.fromId);
    const b = places.get(e.toId);
    if (!a || !b) continue;
    cases.push({
      edgeId: e.id,
      parentA: e.fromId,
      parentB: e.toId,
      x: (a.x + b.x) / 2,
      y: a.y + g.hauteur + g.ecartLig,
    });
  }
  return cases;
}

export interface LigneDates {
  naissance?: string;
  mort?: string;
  /** Âge révolu : à la mort pour un défunt, à la date du jour du monde sinon (absent s'il manque l'une des deux). */
  age?: number;
}

/** Défunt = `death` renseigné, jamais un booléen à part (règle 16). */
export function estDefunt(node: Pick<FamilyTreeNode, "death">): boolean {
  return node.death !== undefined;
}

/**
 * Les dates sous le nom. `null` quand il n'y en a aucune : le composant n'écrit
 * alors RIEN (pas de ligne vide sous le nom).
 */
export function ligneDates(
  node: Pick<FamilyTreeNode, "birth" | "death">,
  formater: (date: GameDate) => string,
  aujourdhui: GameDate | null,
): LigneDates | null {
  if (!node.birth && !node.death) return null;
  const age = ageWithDeath(node.birth, aujourdhui, node.death);
  return {
    ...(node.birth ? { naissance: formater(node.birth) } : {}),
    ...(node.death ? { mort: formater(node.death) } : {}),
    ...(age !== undefined ? { age } : {}),
  };
}

export interface Vue {
  x: number;
  y: number;
  scale: number;
}

function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

/** Tout l'arbre dans la fenêtre : jamais zoomé au-delà de 100 %, seulement dézoomé s'il est plus grand que la zone visible. */
export function vueAjustee(
  arbre: { largeur: number; hauteur: number },
  fenetre: { largeur: number; hauteur: number },
  limites: { min: number; max: number },
  marge = 32,
): Vue {
  const scale = borner(
    Math.min(fenetre.largeur / (arbre.largeur + marge), fenetre.hauteur / (arbre.hauteur + marge), 1),
    limites.min,
    limites.max,
  );
  return {
    scale,
    x: (fenetre.largeur - arbre.largeur * scale) / 2,
    y: (fenetre.hauteur - arbre.hauteur * scale) / 2,
  };
}

/** Le point (monde) `cible` au centre de la fenêtre, à l'échelle donnée : l'arbre s'ouvre centré sur la fiche (téléphone) ou sur « Centrer ici ». */
export function vueCentree(cible: { x: number; y: number }, fenetre: { largeur: number; hauteur: number }, scale: number): Vue {
  return { scale, x: fenetre.largeur / 2 - cible.x * scale, y: fenetre.hauteur / 2 - cible.y * scale };
}

/** Zoom de facteur `facteur` autour d'un point de la fenêtre : le point du monde qui s'y trouve y reste. */
export function zoomerAutour(
  vue: Vue,
  facteur: number,
  point: { x: number; y: number },
  limites: { min: number; max: number },
): Vue {
  const scale = borner(vue.scale * facteur, limites.min, limites.max);
  const mondeX = (point.x - vue.x) / vue.scale;
  const mondeY = (point.y - vue.y) / vue.scale;
  return { scale, x: point.x - mondeX * scale, y: point.y - mondeY * scale };
}
