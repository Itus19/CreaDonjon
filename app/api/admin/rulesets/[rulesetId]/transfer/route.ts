import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transferRulesetSchema } from "@/lib/admin/schemas";
import { adminTransferRuleset } from "@/src/server/services/adminAccounts";

/** Transfère un ruleset PERSONNEL d'un compte à un autre (V3.1-10, superadmin) — jamais `is_official_base = true` (CLAUDE.md règle absolue 18, revérifiée côté service). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const { rulesetId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = transferRulesetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await adminTransferRuleset(supabase, { callerId: user.id, rulesetId, newOwnerId: parsed.data.newOwnerId });
  if (!result.ok) {
    const messages = {
      not_authorized: "Réservé au superadmin.",
      not_found: "Ruleset introuvable.",
      official_base: "Un ruleset officiel ne se transfère pas.",
    };
    const status = result.reason === "not_authorized" ? 403 : result.reason === "official_base" ? 400 : 404;
    return NextResponse.json({ error: messages[result.reason] }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
