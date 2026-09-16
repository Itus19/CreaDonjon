import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { EN_TETE_CHEMIN } from "@/lib/wikiPath";

/**
 * V2.1-20 lot 4 — ce que ce test garde, et pourquoi il vaut la peine.
 *
 * Un lien de partage se resout par son jeton, jamais par une session : le
 * middleware n'a donc aucune raison d'appeler `auth.getUser()` sur
 * `/partage/*`, et cet appel coutait un aller-retour complet (mesure : 229 ms
 * sans cookie de session contre 295 ms avec, distributions disjointes).
 *
 * Mais l'economie est invisible : rien ne CASSE si quelqu'un remet l'appel, et
 * rien ne casse non plus si quelqu'un, en voulant alleger le middleware, retire
 * `/partage` du `matcher` — sauf que le fond de page cesserait alors d'etre
 * rendu cote serveur (le lot 2.1 tire la fiche courante d'un en-tete pose ici).
 * Les deux defauts sont muets. D'ou ces deux assertions.
 *
 * `@supabase/ssr` est simule : ce test ne parle a aucune base. Ce qu'il
 * observe, c'est si le middleware CHERCHE a construire un client.
 */
const createServerClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const { updateSession } = await import("./middleware");

function requete(chemin: string, avecSession = false): NextRequest {
  const r = new NextRequest(`http://localhost:3100${chemin}`);
  if (avecSession) r.cookies.set("sb-projet-auth-token", "base64-peu-importe");
  return r;
}

beforeEach(() => {
  createServerClient.mockReset();
  createServerClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: null } }) },
  });
});

describe("updateSession sur un lien de partage (V2.1-20 lot 4)", () => {
  it("ne construit aucun client Supabase — donc n'appelle jamais getUser", async () => {
    await updateSession(requete("/partage/un-jeton/37"));
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("ne l'appelle pas davantage quand un cookie de session est present : c'est le cas qui coutait 66 ms", async () => {
    await updateSession(requete("/partage/un-jeton/37", true));
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("continue de poser l'en-tete de chemin, dont le fond de page depend depuis le lot 2.1", async () => {
    const reponse = await updateSession(requete("/partage/un-jeton/37"));
    // L'en-tete voyage sur la REQUETE reecrite, pas sur la reponse — c'est ce
    // que `NextResponse.next({ request: { headers } })` transporte jusqu'au
    // layout.
    expect(reponse.headers.get("x-middleware-override-headers")).toContain(EN_TETE_CHEMIN);
  });
});

describe("updateSession ailleurs — le court-circuit ne deborde pas", () => {
  it("construit toujours le client sur une route authentifiee", async () => {
    await updateSession(requete("/m/un-monde/joueur/wiki/37"));
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });

  it("le construit aussi sur les images de bloc, que /partage embarque pourtant", async () => {
    // Elles ne sont PAS couvertes par le court-circuit : leur chemin n'est pas
    // `/partage/*`, et la route a besoin de savoir si elle sert un visiteur
    // anonyme ou un membre (V2.1-20 lot 2).
    await updateSession(requete("/api/blocks/un-bloc/image"));
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });

  it("ne confond pas un chemin qui commence par le meme mot", async () => {
    await updateSession(requete("/partagez-moi"));
    expect(createServerClient).toHaveBeenCalledTimes(1);
  });
});
