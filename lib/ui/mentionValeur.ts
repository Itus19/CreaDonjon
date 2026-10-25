import { infoboxValueNodes, type InfoboxValue } from "@/src/core/schemas/blocks/infobox";
import type { SegmentContentNode } from "@/src/core/schemas/entities/segments";

/**
 * V3.1-66 — « @ » dans une valeur d'Encadré cite une fiche. L'éditeur montre
 * un champ de texte entre chaque mention ; ces fonctions pures repèrent la
 * mention en cours de frappe, l'insèrent, la retirent et remettent la valeur
 * en forme. Une valeur sans mention redevient une chaîne : la forme d'avant.
 */

type NoeudTexte = Extract<SegmentContentNode, { t: "text" }>;

/** Au-delà, on n'est plus en train de citer une fiche. */
const LONGUEUR_REQUETE_MAX = 40;

/** La mention en cours avant le curseur : la position du « @ » et ce qui a été tapé après. */
export function mentionEnCours(texte: string, curseur: number): { debut: number; requete: string } | null {
  const avant = texte.slice(0, curseur);
  const debut = avant.lastIndexOf("@");
  if (debut === -1) return null;
  // Un « @ » collé à un mot (une adresse) n'ouvre pas de mention.
  if (debut > 0 && !/\s/.test(avant[debut - 1]!)) return null;
  const requete = avant.slice(debut + 1);
  if (requete.length > LONGUEUR_REQUETE_MAX || /[\n@]/.test(requete)) return null;
  return { debut, requete };
}

/** Les nœuds d'édition : toujours un nœud texte (éventuellement vide) avant, entre et après les mentions. */
export function noeudsEditables(valeur: InfoboxValue): SegmentContentNode[] {
  const sortie: SegmentContentNode[] = [];
  for (const noeud of infoboxValueNodes(valeur)) {
    const dernier = sortie[sortie.length - 1];
    if (noeud.t === "text") {
      if (dernier?.t === "text") sortie[sortie.length - 1] = { ...dernier, v: dernier.v + noeud.v };
      else sortie.push(noeud);
    } else {
      if (dernier?.t !== "text") sortie.push({ t: "text", v: "" });
      sortie.push(noeud);
    }
  }
  if (sortie[sortie.length - 1]?.t !== "text") sortie.push({ t: "text", v: "" });
  return sortie;
}

/** Remplace, dans le nœud texte `index`, les caractères `debut`..`fin` (« @Sil ») par la mention ; une espace suit pour continuer à écrire. */
export function insererMention(
  noeuds: readonly SegmentContentNode[],
  index: number,
  plage: { debut: number; fin: number },
  mention: SegmentContentNode
): SegmentContentNode[] {
  const cible = noeuds[index];
  if (cible?.t !== "text") return [...noeuds];
  const avant: NoeudTexte = { ...cible, v: cible.v.slice(0, plage.debut) };
  const reste = cible.v.slice(plage.fin);
  const apres: NoeudTexte = { t: "text", v: reste.startsWith(" ") ? reste : ` ${reste}` };
  return [...noeuds.slice(0, index), avant, mention, apres, ...noeuds.slice(index + 1)];
}

/** Retire la mention `index` ; le texte autour se recolle à la normalisation. */
export function retirerMention(noeuds: readonly SegmentContentNode[], index: number): SegmentContentNode[] {
  return noeuds.filter((_, i) => i !== index);
}

/** La valeur à enregistrer : textes voisins fusionnés, textes vides retirés ; sans mention, une chaîne. */
export function normaliserValeur(noeuds: readonly SegmentContentNode[]): InfoboxValue {
  const fusion: SegmentContentNode[] = [];
  for (const noeud of noeuds) {
    const dernier = fusion[fusion.length - 1];
    if (noeud.t === "text" && dernier?.t === "text" && !noeud.marks && !dernier.marks) {
      fusion[fusion.length - 1] = { ...dernier, v: dernier.v + noeud.v };
    } else {
      fusion.push(noeud);
    }
  }
  const utiles = fusion.filter((n) => n.t !== "text" || n.v !== "");
  if (utiles.every((n) => n.t === "text")) return utiles.map((n) => (n.t === "text" ? n.v : "")).join("");
  return utiles;
}

function sansAccent(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Les fiches proposées après « @ » : nom contenant la saisie, sans accents ni casse, au plus six. */
export function suggererFiches<F extends { name: string }>(fiches: readonly F[], requete: string): F[] {
  const cle = sansAccent(requete.trim());
  return fiches.filter((f) => sansAccent(f.name).includes(cle)).slice(0, 6);
}
