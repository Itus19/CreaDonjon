import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { weaponAttackSchema } from "@/lib/characterActions/schemas";
import { rollWeaponAttack } from "@/src/server/services/characterActions";
import { automaticSelfReactions } from "@/src/server/services/rollWindows";
import { naturalD20FromTrace } from "@/src/core/dice/rollAttribution";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  item_not_found: "Objet introuvable dans l'inventaire.",
  not_a_weapon: "Cet objet n'est pas une arme.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, weaponAttackSchema);
  if (!guard.ok) return guard.response;
  const { supabase, entityId, body, userId } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await rollWeaponAttack(supabase, {
    entityId,
    campaignId: body.campaignId,
    itemId: body.itemId,
    advantage: body.advantage,
    locale,
    // V3.1-163 : sans cible, pas de fenêtre ; seules les réactions automatiques sur son propre jet (Chance relance un 1).
    adjust: async (ctx, attack, critRange) => {
      if (!body.campaignId) return attack;
      const natural = naturalD20FromTrace(attack.trace) ?? null;
      const r = await automaticSelfReactions(supabase, {
        campaignId: body.campaignId,
        ctx,
        callerId: userId,
        locale,
        roll: { kind: "attack", roller: entityId, target: null, natural, total: attack.total, critRange, ac: null, dc: null, acBonus: 0, damage: null },
      });
      if (!r.names) return attack;
      const d20 = r.roll.natural ?? natural ?? 0;
      return {
        ...attack,
        total: r.roll.total,
        isCritical: d20 >= critRange,
        isCriticalFail: d20 === 1,
        trace: [...attack.trace, { text: `${r.names} : d20 ${d20}`, value: r.roll.total }],
      };
    },
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
