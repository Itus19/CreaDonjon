/**
 * Le chemin de la requete, rendu lisible depuis un `layout.tsx` (V2.1-20
 * lot 2.1).
 *
 * Pourquoi ce detour existe : le fond de page wiki est par FICHE, mais les
 * jetons qu'il pose (`--h`/`--c`/`data-mode`) sont appliques par `BookSkin`,
 * qui vit dans le `layout.tsx` depuis V2.1-12/19. Or **un layout ne recoit pas
 * les parametres du segment enfant rendu sous lui** : il ne peut donc pas
 * savoir quelle fiche est affichee, et le fond n'apparaissait qu'apres
 * l'hydratation — toute la colonne se repeignait a ce moment-la.
 *
 * Next n'expose aucune API de chemin cote serveur. Le middleware, lui, le
 * connait : il le recopie dans un en-tete de requete, que les layouts relisent
 * ici. Voie 1 des quatre instruites dans V2.1-20 lot 2.1, retenue parce que
 * c'est la seule qui corrige a la fois la teinte ET le mode.
 *
 * Le nom de l'en-tete est declare ICI et nulle part ailleurs : une faute de
 * frappe entre l'ecriture et la lecture ne produirait aucune erreur, juste le
 * retour silencieux au comportement d'avant. C'est precisement le mode d'echec
 * que ce lot devait rendre impossible.
 */
export const EN_TETE_CHEMIN = "x-chemin";

/**
 * Le segment de fiche d'un chemin de wiki, ou `null` s'il n'y en a pas.
 *
 * Meme decoupage que `EntityTree` pour retrouver la fiche active
 * (`components/shell/EntityTree.tsx`) : ce qui suit `hrefBase/`, jusqu'au `/`
 * suivant, desencode. Ecrit ici plutot que recopie dans les trois layouts —
 * et pur, donc verifiable sans requete ni navigateur.
 *
 * `null` couvre trois cas volontairement confondus, parce qu'aucun appelant
 * n'a de raison de les distinguer : pas de chemin du tout (en-tete absent),
 * le chemin ne commence pas par `hrefBase` (le middleware a cesse de couvrir
 * cette route), ou c'est la page de sommaire et non une fiche.
 */
export function entitySlugFromPathname(pathname: string | null | undefined, hrefBase: string): string | null {
  if (!pathname) return null;
  const prefixe = `${hrefBase}/`;
  if (!pathname.startsWith(prefixe)) return null;

  const segment = pathname.slice(prefixe.length).split("/")[0];
  if (!segment) return null;

  // Un slug peut contenir des caracteres encodes (accents), comme dans
  // `EntityTree` — le comparer encode ne trouverait jamais la fiche.
  try {
    return decodeURIComponent(segment);
  } catch {
    // Une sequence d'echappement invalide n'est pas une raison de faire
    // echouer le rendu d'un layout : pas de fiche, pas de fond, la page
    // s'affiche.
    return null;
  }
}
