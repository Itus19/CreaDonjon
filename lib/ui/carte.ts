/**
 * V3.1-78 — noyau pur de la Carte (C) : ranger les punaises et les zones par
 * couches, choisir le marqueur de chaque élément (jetons de la charte),
 * calculer le cadrage qui centre la carte sur un élément, et composer le
 * nom cité par l'annonce de la pastille. Aucune donnée n'est inventée ici :
 * la visibilité réelle reste filtrée par le serveur (ADR 0017).
 */

import { vueCentree, type Vue } from "@/lib/ui/arbre";

export type GenreElement = "pin" | "region";

/** Ce que la liste sait d'un élément : assez pour le ranger, le marquer et centrer la carte dessus. */
export interface ElementCarte {
  id: string;
  genre: GenreElement;
  nom: string;
  layerId: string | null;
  visibilityLevel: string;
  /** Centre en coordonnées normalisées (0 à 1) de l'image. */
  centre: { x: number; y: number };
}

export interface CoucheCarte {
  id: string;
  name: string;
  displayOrder: number;
  visibilityLevel: string;
}

export interface GroupeCouche {
  /** `null` : les éléments sans couche (ou dont la couche n'est pas fournie). */
  couche: CoucheCarte | null;
  elements: ElementCarte[];
}

/** Les couches dans l'ordre d'affichage ; à égalité, par nom puis par ordre d'arrivée (ordre stable). */
export function ordonnerCouches(couches: readonly CoucheCarte[]): CoucheCarte[] {
  return couches
    .map((couche, i) => ({ couche, i }))
    .sort(
      (a, b) =>
        a.couche.displayOrder - b.couche.displayOrder ||
        a.couche.name.localeCompare(b.couche.name) ||
        a.i - b.i,
    )
    .map(({ couche }) => couche);
}

/**
 * Range les éléments par couche : d'abord « sans couche » (s'il y en a),
 * puis chaque couche dans son ordre, même vide (le MJ y ajoute des éléments).
 * Dans une couche : les punaises, puis les zones, chacune dans l'ordre reçu.
 */
export function rangerParCouches(
  couches: readonly CoucheCarte[],
  elements: readonly ElementCarte[],
): GroupeCouche[] {
  const ordonnees = ordonnerCouches(couches);
  const connues = new Set(ordonnees.map((c) => c.id));
  const dans = (layerId: string | null) =>
    elements
      .filter((e) => (e.layerId !== null && connues.has(e.layerId) ? e.layerId : null) === layerId)
      .sort((a, b) => (a.genre === b.genre ? 0 : a.genre === "pin" ? -1 : 1));
  const sansCouche = dans(null);
  return [
    ...(sansCouche.length > 0 ? [{ couche: null, elements: sansCouche }] : []),
    ...ordonnees.map((couche) => ({ couche, elements: dans(couche.id) })),
  ];
}

export interface MarqueurElement {
  forme: "point" | "carre";
  /** Classe Tailwind du jeton de la charte. */
  classe: string;
}

/** Point ambre pour une punaise (orange si elle est réservée au MJ), carré vert pour une zone. */
export function marqueurElement(genre: GenreElement, visibilityLevel: string): MarqueurElement {
  if (genre === "region") return { forme: "carre", classe: "bg-success" };
  return { forme: "point", classe: visibilityLevel === "gm" ? "bg-gm" : "bg-accent" };
}

/** Le centre d'une zone : le milieu de son cadre (pas la moyenne des sommets, que des sommets serrés déséquilibreraient). */
export function centreZone(forme: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (forme.length === 0) return { x: 0.5, y: 0.5 };
  const xs = forme.map((p) => p.x);
  const ys = forme.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export const ZOOM_MAX_CARTE = 8;
export const ZOOM_MIN_CARTE = 0.1;
/** « L'agrandit si besoin » : au moins une fois et demie la largeur ajustée, sinon la punaise se perd. */
const FACTEUR_CADRAGE = 1.5;

/**
 * Le cadrage qui amène `centre` (0 à 1) au milieu de la fenêtre. Ne dézoome
 * jamais ; agrandit jusqu'à 1,5 fois l'échelle « image à la largeur de la
 * fenêtre » si on est plus loin.
 */
export function cadrageSur(
  centre: { x: number; y: number },
  image: { largeur: number; hauteur: number },
  fenetre: { largeur: number; hauteur: number },
  echelleActuelle: number,
): Vue {
  const base = image.largeur > 0 ? fenetre.largeur / image.largeur : 1;
  const echelle = Math.min(ZOOM_MAX_CARTE, Math.max(echelleActuelle, base * FACTEUR_CADRAGE));
  return vueCentree({ x: centre.x * image.largeur, y: centre.y * image.hauteur }, fenetre, echelle);
}

export interface LibellesObjet {
  punaise: string;
  zone: string;
  couche: string;
  /** « et seulement si sa couche l'est aussi » (ADR 0017). */
  suffixePunaise: string;
}

/**
 * Le nom cité par l'annonce de la pastille. Une punaise n'est vue que si sa
 * couche l'est aussi : l'annonce le dit, sinon on croirait l'avoir ouverte.
 */
export function objetPastille(genre: GenreElement | "layer", nom: string, l: LibellesObjet): string {
  const base = `${genre === "pin" ? l.punaise : genre === "region" ? l.zone : l.couche} ${nom}`.trim();
  return genre === "pin" ? `${base} (${l.suffixePunaise})` : base;
}

/** Les niveaux annoncés par l'infobulle d'une punaise : nom, couche, visibilité. */
export function texteInfoBulle(nom: string, couche: string | null, visibilite: string): string {
  return [nom, couche, visibilite].filter((s): s is string => !!s && s.trim() !== "").join(" · ");
}

/** Les punaises et zones reçues du serveur, mises en forme de liste (le centre d'une punaise est sa position). */
export function elementsDepuis(
  pins: readonly { id: string; x: number; y: number; label: string; layerId: string | null; visibilityLevel: string }[],
  regions: readonly { id: string; name: string; shape: readonly { x: number; y: number }[]; layerId: string | null; visibilityLevel: string }[],
): ElementCarte[] {
  return [
    ...pins.map((p) => ({ id: p.id, genre: "pin" as const, nom: p.label, layerId: p.layerId, visibilityLevel: p.visibilityLevel, centre: { x: p.x, y: p.y } })),
    ...regions.map((r) => ({ id: r.id, genre: "region" as const, nom: r.name, layerId: r.layerId, visibilityLevel: r.visibilityLevel, centre: centreZone(r.shape) })),
  ];
}
