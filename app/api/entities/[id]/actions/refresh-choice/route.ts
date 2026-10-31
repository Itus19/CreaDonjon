import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { refreshChoiceSchema } from "@/lib/characterActions/schemas";
import { refreshCharacterChoice } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

/**
 * V3.1-119 — Choisir à nouveau (ou garder) un choix qu'un repos a rouvert.
 * Mêmes droits qu'un repos (`guardSheetActionRoute`) ; le service vérifie que
 * le choix est bien rouvert et valide la réponse avec le moteur.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, refreshChoiceSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await refreshCharacterChoice(supabase, {
    entityId,
    campaignId: body.campaignId,
    key: body.key,
    values: body.values,
    actorUserId: userId,
    locale,
  });

  if ("error" in result) {
    const statut = { not_found: 404, not_refreshable: 409, invalid_answer: 400, version_conflict: 409 } as const;
    const message = {
      not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
      not_refreshable: "Ce choix n'est pas à refaire.",
      invalid_answer: "Réponse invalide pour ce choix.",
      version_conflict: "La fiche a changé entre-temps : rechargez-la.",
    } as const;
    return NextResponse.json({ error: message[result.error] }, { status: statut[result.error] });
  }
  return new NextResponse(null, { status: 204 });
}
