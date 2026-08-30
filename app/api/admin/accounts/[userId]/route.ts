import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteInvitedAccount } from "@/src/server/services/campaignInvites";

/**
 * Supprime un compte invité (V2-M6, Lot M) — la vérification superadmin
 * vit dans le service (`deleteInvitedAccount`), pas ici : elle a aussi
 * besoin de distinguer "pas superadmin" de "pas un compte invité", deux
 * refus différents.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await deleteInvitedAccount(supabase, { callerId: user.id, targetUserId });
  if (!result.ok) {
    const messages = {
      not_superadmin: "Réservé au superadmin.",
      not_an_invited_account: "Ce compte n'a pas été créé par un lien d'invitation.",
    };
    const status = result.reason === "not_superadmin" ? 403 : 400;
    return NextResponse.json({ error: messages[result.reason] }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
