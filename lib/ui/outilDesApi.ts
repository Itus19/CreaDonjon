/**
 * Appels de l'outil de dés (V3.1-33), sortis du composant : ils partent d'un
 * geste (« Lancer », « Relancer »), jamais d'un chargement après affichage.
 * Le fichier n'a aucun effet de montage (cliquet du câblage, docs/CABLAGE.md §6).
 * Le client décrit le jet, jamais son résultat (règle 8).
 */

export function posterJet(url: string, corps: object): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
}

/** Le message d'erreur du serveur s'il en donne un, sinon `parDefaut` — qui est AFFICHÉ, rien n'est avalé. */
export async function messageErreur(res: Response, parDefaut: string): Promise<string> {
  const corps: unknown = await res.json().catch(() => null);
  if (corps && typeof corps === "object" && typeof (corps as { error?: unknown }).error === "string") return (corps as { error: string }).error;
  return parDefaut;
}
