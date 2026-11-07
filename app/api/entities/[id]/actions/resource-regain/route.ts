import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { resourceRegainSchema } from "@/lib/characterActions/schemas";
import { regainResource } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<"not_found" | "no_regain" | "full" | "cannot_pay", string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  no_regain: "Cette ressource ne se regagne pas en dépensant autre chose.",
  full: "Cette ressource n'a aucune utilisation à regagner.",
  cannot_pay: "De quoi payer ce regain manque.",
};

/**
 * ADR 0076 (V3.1-183) — regagner une utilisation d'une ressource en dépensant
 * autre chose. Même barrière que la dépense d'une ressource
 * (`guardSheetActionRoute` : Zod, session, droit d'agir) ; le coût se vérifie
 * côté serveur, jamais sur la foi du client.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, resourceRegainSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const result = await regainResource(supabase, {
    entityId,
    campaignId: body.campaignId,
    resourceKey: body.resourceKey,
    ...(body.slotLevel !== undefined ? { slotLevel: body.slotLevel } : {}),
    actorUserId: userId,
    locale: (await getLocale()) as Locale,
  });
  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: result.error === "not_found" ? 404 : 400 });
  }
  return new NextResponse(null, { status: 204 });
}
