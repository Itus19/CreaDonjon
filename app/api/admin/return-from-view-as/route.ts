import { NextResponse, type NextRequest } from "next/server";
import { returnFromViewAs } from "@/src/server/services/viewAs";

const REASON_STATUS = { not_superadmin: 403, not_found: 404, not_an_invited_account: 400 } as const;
const REASON_MESSAGE = {
  not_superadmin: "Cookie de retour invalide.",
  not_found: "Compte administrateur introuvable.",
  not_an_invited_account: "Cookie de retour invalide.",
} as const;

/**
 * Retour vers le superadmin (retour utilisateur, bandeau "voir comme") — lit
 * le cookie pose par `/api/admin/view-as`, jamais la session courante (qui
 * EST le compte impersonne a ce stade). Efface le cookie dans tous les cas
 * (succes ou echec) : un cookie invalide ne doit jamais rester a trainer.
 */
export async function POST(request: NextRequest) {
  const adminUserId = request.cookies.get("view_as_admin_uid")?.value;
  if (!adminUserId) {
    return NextResponse.json({ error: "Aucune session admin a restaurer." }, { status: 400 });
  }

  const result = await returnFromViewAs(adminUserId);
  if (!result.ok) {
    const response = NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
    response.cookies.delete("view_as_admin_uid");
    return response;
  }

  const response = NextResponse.json({ url: `/auth/confirm?token_hash=${result.tokenHash}&type=magiclink&next=/` }, { status: 200 });
  response.cookies.delete("view_as_admin_uid");
  return response;
}
