/**
 * V3.1-72 — noyau pur du Réseau (B) : le voisinage qu'allume un survol, les
 * filtres par genre et leur nombre, « Trouver… », la machine du toucher au
 * téléphone, les noms utiles. Le composant ne fait que dessiner ; le graphe
 * (`buildRelationsGraph`) reste calculé ailleurs.
 */

import type { RelationsGraph, RelationsGraphEdge, RelationsGraphNode } from "@/src/core/relationsGraph/buildRelationsGraph";

/** Les quatre genres de la charte, plus « autres » pour tout le reste (créature, quête, événement…). */
export const GROUPES_RESEAU = ["character", "location", "faction", "item", "autre"] as const;
export type GroupeReseau = (typeof GROUPES_RESEAU)[number];

export function groupeDe(entityKind: string): GroupeReseau {
  return entityKind === "character" || entityKind === "location" || entityKind === "faction" || entityKind === "item"
    ? entityKind
    : "autre";
}

export interface Voisinage {
  /** La fiche elle-même et ses voisins directs. */
  noeuds: Set<string>;
  /** Exactement les liens qui touchent la fiche. */
  liens: Set<string>;
}

/** Ce qu'allume le survol d'une vignette : ses liens et ses voisins, rien d'autre. */
export function voisinage(graph: Pick<RelationsGraph, "edges">, id: string): Voisinage {
  const noeuds = new Set<string>([id]);
  const liens = new Set<string>();
  for (const e of graph.edges) {
    if (e.fromId !== id && e.toId !== id) continue;
    liens.add(e.id);
    noeuds.add(e.fromId === id ? e.toId : e.fromId);
  }
  return { noeuds, liens };
}

export interface FiltreGenre {
  groupe: GroupeReseau;
  n: number;
}

/**
 * Un filtre par genre présent, avec son nombre (« Lieux · 4 »). La fiche du
 * centre n'est pas comptée : elle ne se masque jamais, il n'y a rien à
 * basculer pour elle.
 */
export function filtresParGenre(nodes: readonly RelationsGraphNode[]): FiltreGenre[] {
  const compte = new Map<GroupeReseau, number>();
  for (const n of nodes) {
    if (n.degree === 0) continue;
    const g = groupeDe(n.entityKind);
    compte.set(g, (compte.get(g) ?? 0) + 1);
  }
  return GROUPES_RESEAU.filter((g) => compte.has(g)).map((g) => ({ groupe: g, n: compte.get(g) ?? 0 }));
}

/** Les fiches qu'on montre : tout, sauf les genres masqués — et la fiche du centre, jamais masquée. */
export function idsVisibles(nodes: readonly RelationsGraphNode[], masques: ReadonlySet<GroupeReseau>): Set<string> {
  return new Set(nodes.filter((n) => n.degree === 0 || !masques.has(groupeDe(n.entityKind))).map((n) => n.id));
}

/** Un lien se montre si ses deux bouts se montrent. */
export function lienVisible(edge: Pick<RelationsGraphEdge, "fromId" | "toId">, visibles: ReadonlySet<string>): boolean {
  return visibles.has(edge.fromId) && visibles.has(edge.toId);
}

/** Sans accents ni casse : « Eléonore » et « eleonore » se valent. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** « Trouver… » : les fiches dont le nom contient le texte ; texte vide, rien ne brille. */
export function trouver(nodes: readonly RelationsGraphNode[], texte: string): Set<string> {
  const cherche = normaliser(texte);
  if (cherche === "") return new Set();
  return new Set(nodes.filter((n) => normaliser(n.name).includes(cherche)).map((n) => n.id));
}

export interface ToucherEtat {
  selection: string | null;
}

/**
 * Le toucher au téléphone : le premier toucher d'une vignette la SÉLECTIONNE
 * (elle s'allume, les noms de ses voisins paraissent), le second, sur la même,
 * l'OUVRE. Toucher une autre vignette déplace la sélection.
 */
export function toucher(etat: ToucherEtat, id: string): { etat: ToucherEtat; ouvrir: boolean } {
  if (etat.selection === id) return { etat, ouvrir: true };
  return { etat: { selection: id }, ouvrir: false };
}

/** Au téléphone, seuls ces noms s'écrivent : la fiche du centre, la sélection et ses voisins. */
export function nomsUtiles(graph: RelationsGraph, selection: string | null): Set<string> {
  const ids = new Set(graph.nodes.filter((n) => n.degree === 0).map((n) => n.id));
  if (selection) for (const id of voisinage(graph, selection).noeuds) ids.add(id);
  return ids;
}

export interface LienDeCarte {
  id: string;
  label: string;
  autre: string;
  /** `true` : la fiche est la source du lien (« membre de Alliance »), sinon c'en est la cible. */
  sortant: boolean;
}

/** Les (trois) premiers liens de la carte d'une fiche, avec le nom de l'autre bout. */
export function liensDeCarte(graph: RelationsGraph, id: string, max = 3): LienDeCarte[] {
  const noms = new Map(graph.nodes.map((n) => [n.id, n.name]));
  const liens: LienDeCarte[] = [];
  for (const e of graph.edges) {
    if (e.fromId !== id && e.toId !== id) continue;
    const sortant = e.fromId === id;
    liens.push({ id: e.id, label: e.label, autre: noms.get(sortant ? e.toId : e.fromId) ?? "", sortant });
    if (liens.length === max) break;
  }
  return liens;
}
