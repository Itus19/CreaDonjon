import { preload } from "react-dom";
import type { WikiBackground } from "@/src/server/services/publicShare";

/**
 * Annonce l'image de fond de la fiche dans le HTML, pendant le rendu serveur
 * (V2.1-20 lot 2).
 *
 * Composant SERVEUR, délibérément — c'est tout son intérêt. Le fond lui-même
 * reste déclaré par `WikiBackgroundRegistrar`, qui est client et ne peut agir
 * qu'après l'hydratation : c'est le fournisseur qui monte la div de fond, et
 * le navigateur ne découvre donc l'URL de l'image qu'à ce moment-là.
 *
 * Chronologie mesurée avant d'écrire ceci (V2.1-20 lot 0, build de production,
 * fiche « Prologue ») :
 *
 * |  936 ms | HTML entièrement reçu — la page est lisible                  |
 * |  993 ms | dernier module JS reçu                                       |
 * | 1263 ms | la requête de l'image de fond part enfin                     |
 * | 1402 ms | image reçue (après la redirection 307)                       |
 *
 * 327 ms d'attente après que la page soit lisible, uniquement parce que
 * personne n'avait dit au navigateur qu'il aurait besoin de ce fichier. Un
 * `<link rel="preload">` posé dans le HTML le lui dit : le téléchargement part
 * avec le reste de la page au lieu d'attendre son tour derrière le bundle.
 *
 * Ne change RIEN au moment où le fond s'affiche ni à la façon dont il
 * s'affiche : la div, le fondu d'entrée et le fondu de sortie de V2-G13
 * restent entièrement au fournisseur. Ce composant ne fait que déplacer le
 * téléchargement plus tôt, pour que l'image soit déjà là quand le fournisseur
 * la demande.
 *
 * `preload()` de `react-dom` plutôt qu'un `<link>` écrit à la main : c'est
 * l'API prévue pour ça, elle déduplique d'elle-même si deux rendus demandent
 * la même ressource, et React la hisse dans le `<head>`. Elle s'appelle
 * pendant le rendu, ce n'est pas un hook — l'appeler sous condition est
 * correct.
 *
 * Pas de `fetchPriority: "high"` : à ce moment-là le navigateur télécharge
 * encore le JS de la page, et passer devant lui retarderait l'hydratation pour
 * gagner sur une image d'ambiance. On veut que le téléchargement COMMENCE
 * tôt, pas qu'il passe avant le contenu.
 */
export default function WikiBackgroundPreload({
  background,
}: {
  background: WikiBackground | null | undefined;
}) {
  if (background) preload(background.imageUrl, { as: "image" });
  return null;
}
