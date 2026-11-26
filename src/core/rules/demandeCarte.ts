/**
 * V3.2-42 — Le joueur demande-t-il ce que le lieu sert ou ce que ça coûte ?
 * (décidé par l'auteur le 26 novembre : la carte se tire dès qu'on la
 * demande, sans attendre le bouton « Tirer la carte du lieu »).
 *
 * Lexique fermé, lu sur le texte du joueur seul, sans les paroles entre
 * guillemets mises de côté : « c'est combien ? » est justement une parole.
 * Fonction pure : aucune lecture, aucune écriture.
 */

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const DEMANDE = [
  /\bprix\b/,
  /\bcombien\b/,
  /\bcoute(nt)?\b/,
  /\btarifs?\b/,
  // « la carte des vins » oui ; « la carte du royaume » (une carte géographique) non.
  /\bla carte\b(?!\s+(du|de la|de l'|d'))/,
  /\bmenu\b/,
  /\bardoise\b/,
  /\ba (manger|boire)\b/,
  /\b(manger|boire|me restaurer|nous restaurer)\b/,
  /\b(repas|petit[- ]dejeuner|dejeuner|diner|souper)\b/,
  /\b(une|la|des) chambres?\b/,
  /\b(commande|commander)\b/,
];

/** Vrai quand le texte demande à manger, à boire, une chambre, la carte ou un prix. */
export function demandeLaCarte(texteJoueur: string): boolean {
  const texte = sansAccents(texteJoueur);
  return DEMANDE.some((re) => re.test(texte));
}
