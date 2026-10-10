import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { weaponAttackSchema } from "@/lib/characterActions/schemas";
import { rollWeaponAttack } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  item_not_found: "Objet introuvable dans l'inventaire.",
  not_a_weapon: "Cet objet n'est pas une arme.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, weaponAttackSchema);
  if (!guard.ok) return guard.response;
  const { supabase, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await rollWeaponAttack(supabase, {
    entityId,
    campaignId: body.campaignId,
    itemId: body.itemId,
    advantage: body.advantage,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
