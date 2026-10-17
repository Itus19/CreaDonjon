import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { hitDiceChangeSchema } from "@/lib/characterActions/schemas";
import { changeHitDice } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

/** V3.1-34 (outil Table) : dés de vie restants ▲▼, bornés au total de la fiche. Interrupteur « hit_dice ». */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, hitDiceChangeSchema, "hit_dice");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await changeHitDice(supabase, {
    entityId,
    campaignId: body.campaignId,
    die: body.die,
    delta: body.delta,
    actorUserId: userId,
    locale,
  });
  if ("error" in result) return NextResponse.json({ error: "Fiche ou dé de vie introuvable." }, { status: 404 });
  return NextResponse.json(result, { status: 200 });
}
