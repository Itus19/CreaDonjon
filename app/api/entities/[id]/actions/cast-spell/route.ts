import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { castSpellSchema } from "@/lib/characterActions/schemas";
import { castSpell } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  item_not_found: "Ce sort n'est pas connu par ce personnage.",
  not_a_weapon: "Erreur inattendue.",
  not_a_spellcaster: "Erreur inattendue.",
  no_slot_available: "Aucun emplacement disponible à ce niveau.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, castSpellSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await castSpell(supabase, {
    entityId,
    campaignId: body.campaignId,
    spellKey: body.spellKey,
    slotLevel: body.slotLevel,
    critical: body.critical,
    actorUserId: userId,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
