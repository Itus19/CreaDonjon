import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { deathSaveSchema } from "@/lib/characterActions/schemas";
import type { Locale } from "@/src/i18n/request";
import { rollDeathSaveForCharacter } from "@/src/server/services/characterActions";

/**
 * V3.1-32 — jet contre la mort depuis la fiche. Meme garde que les autres
 * gestes de fiche (PJ revendique, MJ, fiche accordee) ; le d20 est lance par
 * le serveur, sauf vrai de annonce. 409 hors d'un personnage a 0 PV en jeu.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, deathSaveSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const locale = (await getLocale()) as Locale;
  const result = await rollDeathSaveForCharacter(supabase, {
    entityId,
    campaignId: body.campaignId,
    natural: body.natural,
    actorUserId: userId,
    locale,
  });
  if (!result.ok) {
    return result.reason === "not_found"
      ? NextResponse.json({ error: "Fiche de personnage introuvable." }, { status: 404 })
      : NextResponse.json({ error: "Ce personnage n'est pas en train de mourir (PV au-dessus de 0, stabilisé ou mort)." }, { status: 409 });
  }
  return NextResponse.json(result, { status: 200 });
}
