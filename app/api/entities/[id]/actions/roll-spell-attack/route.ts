import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { spellAttackSchema } from "@/lib/characterActions/schemas";
import { rollSpellAttack } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  item_not_found: "Ce sort n'est pas connu par ce personnage.",
  not_a_weapon: "Erreur inattendue.",
  not_a_spellcaster: "Ce personnage ne lance pas de sorts.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, spellAttackSchema);
  if (!guard.ok) return guard.response;
  const { supabase, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await rollSpellAttack(supabase, {
    entityId,
    campaignId: body.campaignId,
    spellKey: body.spellKey,
    advantage: body.advantage,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
