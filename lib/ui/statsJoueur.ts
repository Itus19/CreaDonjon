/**
 * V3.1-91 — La logique pure du volet « Tes dés et tes titres » : hauteur des
 * barres, graduations, format de la moyenne, classes de couleur d'un titre.
 * Aucun calcul de statistique ici (le noyau `src/core/stats` fait foi) : on ne
 * fait que présenter les compteurs que la route rend.
 */

/** Les graduations de l'axe, en numéros de face (1 à 20). */
export const GRADUATIONS = [1, 5, 10, 15, 20] as const;

/** Une barre non vide reste visible même quand elle est minuscule devant le maximum. */
const HAUTEUR_MIN = 4;

/**
 * La hauteur d'une barre en pourcentage de la zone : proportionnelle au
 * compteur, la plus haute remplit exactement la zone (jamais au-delà, donc
 * jamais sur le chiffre au-dessus). Un compteur à zéro n'a pas de barre.
 */
export function hauteurBarre(compteur: number, maximum: number): number {
  if (compteur <= 0 || maximum <= 0) return 0;
  return Math.min(100, Math.max(HAUTEUR_MIN, Math.round((compteur / maximum) * 100)));
}

/** Le plus grand des compteurs (0 pour une liste vide). */
export function maximumCompteurs(compteurs: readonly number[]): number {
  return compteurs.reduce((max, c) => (c > max ? c : max), 0);
}

/** La moyenne avec une décimale et la virgule de la langue (« 11,4 ») ; `—` sans moyenne. */
export function formaterMoyenne(moyenne: number | null, locale: string): string {
  if (moyenne === null) return "—";
  return moyenne.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Une barre : rouge pour le 1, verte pour le 20, accent atténué pour les autres. */
export function classeBarre(face: number): string {
  if (face === 1) return "bg-danger";
  if (face === 20) return "bg-success";
  return "bg-accent/40";
}

/**
 * Les classes d'une pastille d'icône teintée selon le jeton de couleur d'un
 * titre. Chaque classe est écrite en entier : Tailwind ne devine pas une
 * classe assemblée à la volée.
 */
export function classesPastille(jeton: string): string {
  switch (jeton) {
    case "success":
      return "border-success/40 bg-success/15 text-success";
    case "danger":
      return "border-danger/40 bg-danger/15 text-danger";
    case "link_entity":
      return "border-link-entity/40 bg-link-entity/15 text-link-entity";
    case "link_rule":
      return "border-link-rule/40 bg-link-rule/15 text-link-rule";
    default:
      return "border-accent/40 bg-accent/15 text-accent";
  }
}
