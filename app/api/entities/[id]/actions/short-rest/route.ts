import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { shortRestSchema } from "@/lib/characterActions/schemas";
import { takeShortRest } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, shortRestSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await takeShortRest(supabase, {
    entityId,
    campaignId: body.campaignId,
    hitDiceSpent: body.hitDiceSpent,
    actorUserId: userId,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: "Fiche de personnage introuvable ou sans ruleset résolvable." }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
