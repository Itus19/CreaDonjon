import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { spellSlotUsageSchema } from "@/lib/characterActions/schemas";
import { changeSpellSlotUsage } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<"not_found" | "no_slot_available", string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  no_slot_available: "Ce personnage n'a pas d'emplacement à ce niveau.",
};

/**
 * V3.1-114 — l'égaliseur : dépenser ou rendre un emplacement à la main. Même
 * barrière que les autres gestes de la fiche (`guardSheetActionRoute` :
 * Zod, session, droit d'agir, interrupteur « spell_slots » du MJ).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Geste manuel : l'interrupteur « emplacements » du MJ s'applique (V3.1-108), comme sur la fiche.
  const guard = await guardSheetActionRoute(request, params, spellSlotUsageSchema, "spell_slots");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const result = await changeSpellSlotUsage(supabase, {
    entityId,
    campaignId: body.campaignId,
    pool: body.pool,
    level: body.pool === "slots" ? body.level : null,
    delta: body.delta,
    actorUserId: userId,
    locale: (await getLocale()) as Locale,
  });
  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
