import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminListOwnedRulesets } from "@/src/server/services/adminAccounts";

/** Rulesets personnels d'un compte (V3.1-10, superadmin) — pour choisir lequel transférer. Jamais `is_official_base = true` (filtré côté service, règle absolue 18). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const rulesets = await adminListOwnedRulesets(supabase, { callerId: user.id, targetUserId });
  if (rulesets === null) {
    return NextResponse.json({ error: "Réservé au superadmin." }, { status: 403 });
  }
  return NextResponse.json({ rulesets }, { status: 200 });
}
