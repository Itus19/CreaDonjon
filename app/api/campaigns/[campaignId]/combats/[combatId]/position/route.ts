import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { moveParticipantSchema } from "@/lib/combats/schemas";
import { moveParticipant } from "@/src/server/services/combatPositions";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), combatId: z.string().uuid() });

const MESSAGES = {
  not_found: { status: 404, error: "Combat ou participant introuvable." },
  ended: { status: 409, error: "Ce combat n'est pas en cours." },
  no_character: { status: 403, error: "Aucun personnage à toi dans cette campagne." },
  not_yours: { status: 403, error: "Tu ne déplaces que ton personnage." },
  refused: { status: 403, error: "Déplacement refusé." },
} as const;

/**
 * V3.1-169 (ADR 0077) — déplacer un jeton sur le plan. Pas la garde des
 * routes de combat (réservées au MJ) : le MJ déplace tout le monde, une
 * joueuse son seul PJ, et la barrière est alors `public.set_own_position`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = moveParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await moveParticipant(supabase, {
    ...parsedParams.data,
    userId: user.id,
    participantId: parsed.data.participantId,
    position: parsed.data.position,
    locale: (await getLocale()) as Locale,
  });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ participantId: result.participantId, position: result.position, movement: result.movement }, { status: 200 });
}
