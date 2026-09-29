import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminForcePasswordReset } from "@/src/server/services/adminAccounts";

/** "Forcer une réinitialisation" généralisée à tout compte (V3.1-10, superadmin) — même primitive que la version MJ scopée à une campagne (`campaigns/[id]/members/[userId]/reset-password`), jamais de mot de passe tapé à la main. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await adminForcePasswordReset(supabase, { callerId: user.id, targetUserId });
  if (!result.ok) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  return NextResponse.json({ url: `/reinitialiser/${result.token}` }, { status: 200 });
}
