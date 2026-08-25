import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { spellAttackSchema } from "@/lib/characterActions/schemas";
import { rollSpellAttack } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset resolvable.",
  item_not_found: "Ce sort n'est pas connu par ce personnage.",
  not_a_weapon: "Erreur inattendue.",
  not_a_spellcaster: "Ce personnage ne lance pas de sorts.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = spellAttackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;
  const result = await rollSpellAttack(supabase, {
    entityId,
    campaignId: parsed.data.campaignId,
    spellKey: parsed.data.spellKey,
    advantage: parsed.data.advantage,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
