import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startViewAs } from "@/src/server/services/viewAs";

const REASON_STATUS = { not_superadmin: 403, not_found: 404, not_an_invited_account: 400 } as const;
const REASON_MESSAGE = {
  not_superadmin: "Reserve au superadmin.",
  not_found: "Compte introuvable.",
  not_an_invited_account: "Ce compte n'a pas ete cree par un lien d'invitation.",
} as const;

/**
 * Demarre "voir comme" (retour utilisateur, section Administration) : pose
 * un cookie httpOnly portant l'id du superadmin AVANT de renvoyer le lien de
 * connexion vers le compte cible — c'est ce cookie qui permet de revenir
 * ensuite (`/api/admin/return-from-view-as`), une fois la session reellement
 * remplacee par celle du compte cible.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const targetUserId = body?.targetUserId;
  if (typeof targetUserId !== "string" || targetUserId === "") {
    return NextResponse.json({ error: "targetUserId requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await startViewAs(supabase, { callerId: user.id, targetUserId });
  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
  }

  const response = NextResponse.json({ url: `/auth/confirm?token_hash=${result.tokenHash}&type=magiclink&next=/` }, { status: 200 });
  response.cookies.set("view_as_admin_uid", user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return response;
}
