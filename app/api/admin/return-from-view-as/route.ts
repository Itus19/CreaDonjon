import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LEGACY_VIEW_AS_COOKIE, VIEW_AS_RETURN_COOKIE, returnFromViewAs } from "@/src/server/services/viewAs";

/**
 * Retour de "voir comme" (bandeau, ADR 0051) — reprend la session mise de
 * cote par `/api/admin/view-as` a partir du jeton de rafraichissement du
 * cookie httpOnly. Ce jeton ne se forge pas : aucune verification de role
 * n'est necessaire, et aucun lien de connexion n'est fabrique pour qui que
 * ce soit. Efface les cookies dans tous les cas (succes ou echec) : un
 * cookie invalide ne doit jamais rester a trainer.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(VIEW_AS_RETURN_COOKIE)?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ error: "Aucune session à restaurer : reconnectez-vous." }, { status: 400 });
    response.cookies.delete(LEGACY_VIEW_AS_COOKIE);
    return response;
  }

  const supabase = await createClient();
  const result = await returnFromViewAs(supabase, refreshToken);
  const response = result.ok
    ? NextResponse.json({ url: "/" }, { status: 200 })
    : NextResponse.json({ error: "Session d'origine expirée : reconnectez-vous." }, { status: 401 });
  response.cookies.delete(VIEW_AS_RETURN_COOKIE);
  response.cookies.delete(LEGACY_VIEW_AS_COOKIE);
  return response;
}
