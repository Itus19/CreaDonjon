import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { heroicRerollSchema } from "@/lib/characterActions/schemas";
import { rerollWithHeroicInspiration } from "@/src/server/services/checkRolls";
import type { Locale } from "@/src/i18n/request";

const REASON_STATUS = { not_found: 404, forbidden: 403, no_inspiration: 409 } as const;
const REASON_MESSAGE = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  forbidden: "Vous n'avez pas le droit de rouler pour cette fiche.",
  no_inspiration: "Plus d'Inspiration héroïque à dépenser.",
} as const;

/**
 * V3.1-33 — relance d'un test rate par l'Inspiration heroique (bande
 * d'apres-jet de l'outil de des). Sans `field` : la depense est un effet de
 * regle, pas un geste manuel soumis a l'interrupteur de table.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, heroicRerollSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await rerollWithHeroicInspiration(supabase, {
    entityId,
    campaignId: body.campaignId,
    callerId: userId,
    check: body.check,
    advantage: body.advantage,
    dc: body.dc,
    hidden: body.hidden,
    dcPrivate: body.dcPrivate,
    locale,
  });

  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
  }
  return NextResponse.json(result.roll, { status: 200 });
}
