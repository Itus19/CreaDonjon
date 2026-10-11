/**
 * V3.1-62 — mesure du cablage, en DEVELOPPEMENT seulement et sur demande
 * (`CREADONJON_MESURE=1 npm run dev`). Chaque requete d'un client Supabase
 * cote serveur (pages, routes, middleware) ecrit une ligne
 * `[mesure] {...}` dans le journal du serveur : origine, depart, duree,
 * methode, chemin (sans la requete ni aucun en-tete : ni jeton, ni cle).
 * `scripts/analyse-mesure.ts` en tire, page par page, le nombre de
 * requetes et de vagues. Hors de ce mode, rend `undefined` : le client
 * garde le `fetch` normal, rien ne change en production.
 */
export function measuredFetch(origine: "serveur" | "middleware"): typeof fetch | undefined {
  if (process.env.NODE_ENV === "production" || process.env.CREADONJON_MESURE !== "1") return undefined;
  return async (input, init) => {
    const debut = Date.now();
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const methode = init?.method ?? (input instanceof Request ? input.method : "GET");
    const reponse = await fetch(input, init);
    console.info(
      `[mesure] ${JSON.stringify({ origine, debut, ms: Date.now() - debut, methode, chemin: url.pathname, statut: reponse.status })}`
    );
    return reponse;
  };
}
