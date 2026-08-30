import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/src/server/services/account";
import { resetInviteToken } from "@/src/server/services/campaignInvites";

/**
 * Réinitialise un lien (V2-M6, Lot M) : nouveau jeton, l'ancien cesse
 * immédiatement de fonctionner (`token_hash` unique) — le compte/rôle/
 * campagne restent inchangés. Le nouveau jeton n'est renvoyé qu'ICI, une
 * seule fois (même discipline qu'à la création).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!(await isSuperadmin(supabase, user.id))) {
    return NextResponse.json({ error: "Réservé au superadmin." }, { status: 403 });
  }

  const result = await resetInviteToken(supabase, inviteId);
  if (!result) {
    return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  }
  return NextResponse.json({ url: `/rejoindre/${result.token}` }, { status: 200 });
}
