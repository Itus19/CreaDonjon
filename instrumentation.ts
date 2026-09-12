import type { Instrumentation } from "next";

/**
 * Trace des erreurs serveur (audit B-13). Jusqu'ici, une erreur non
 * rattrapee dans un composant serveur, une route ou une server action
 * devenait un 500 muet : aucune trace nulle part, et rien a regarder quand
 * quelqu'un dit "ca a plante quand j'ai clique sur X".
 *
 * Choix du mecanisme : `onRequestError` de Next (documente dans
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * instrumentation.md) plutot qu'une enveloppe posee sur chacune des 144
 * routes. Un seul fichier, aucune route touchee, aucun changement de
 * comportement — l'erreur suit exactement le meme chemin qu'avant, elle
 * laisse simplement une trace au passage.
 *
 * `console.error` plutot qu'un service externe : sur Vercel ces lignes
 * apparaissent dans les journaux de la fonction sans rien installer, et
 * cela n'ajoute aucune dependance ni aucun envoi de donnees hors du
 * serveur. Brancher un collecteur plus tard ne changera que le corps de
 * cette fonction.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // `digest` : quand React traite l'erreur pendant le rendu d'un composant
  // serveur, `err` n'est pas forcement l'erreur d'origine — c'est ce champ
  // qui permet de recoller les deux (voir la doc citee plus haut).
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;

  // JAMAIS `request.headers` : ils portent le cookie de session Supabase.
  // Journaliser un jeton d'authentification dans un fichier de log, c'est
  // le rendre lisible par tout ce qui lit les logs. Le chemin et la methode
  // suffisent a retrouver le geste ; `request.path` peut contenir une
  // chaine de recherche, jamais un secret.
  console.error(
    JSON.stringify({
      niveau: "erreur",
      horodatage: new Date().toISOString(),
      message,
      digest,
      chemin: request.path,
      methode: request.method,
      route: context.routePath,
      typeDeRoute: context.routeType,
      stack,
    })
  );
};
