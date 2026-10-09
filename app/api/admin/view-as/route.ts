import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_RETURN_COOKIE, captureReturnSession, startViewAs } from "@/src/server/services/viewAs";
import { viewAsSchema } from "@/lib/auth/schemas";

const REASON_STATUS = { not_authorized: 403, not_found: 404, not_a_member: 403, ordinary_account: 400 } as const;
const REASON_MESSAGE = {
  not_authorized: "Action non autorisée.",
  not_found: "Compte introuvable.",
  not_a_member: "Ce compte n'est pas membre de cette campagne.",
  ordinary_account: "« Voir comme » ne s'utilise que sur un compte sans email.",
} as const;

/**
 * Demarre "voir comme" (retour utilisateur, section Administration) : met
 * de cote, dans un cookie httpOnly, le jeton de rafraichissement de la
 * session de l'appelant AVANT de renvoyer le lien de connexion vers le
 * compte cible — c'est ce jeton qui permet de revenir ensuite
 * (`/api/admin/return-from-view-as`, ADR 0051), jamais un identifiant.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = viewAsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "targetUserId requis." }, { status: 400 });
  }
  const { targetUserId, campaignId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await startViewAs(supabase, { callerId: user.id, targetUserId, campaignId });
  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
  }

  // Sans session a reprendre, pas de depart : on resterait coince dans le compte cible.
  const returnToken = await captureReturnSession(supabase);
  if (!returnToken) {
    return NextResponse.json({ error: "Session à renouveler : reconnectez-vous avant « voir comme »." }, { status: 401 });
  }

  const response = NextResponse.json({ url: `/auth/confirm?token_hash=${result.tokenHash}&type=magiclink&next=/` }, { status: 200 });
  response.cookies.set(VIEW_AS_RETURN_COOKIE, returnToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });
  return response;
}
