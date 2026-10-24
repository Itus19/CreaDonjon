import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { myInitiativeSchema } from "@/lib/combats/schemas";
import { setMyInitiative } from "@/src/server/services/ownInitiative";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), combatId: z.string().uuid() });

const MESSAGES = {
  not_found: { status: 404, error: "Combat introuvable." },
  not_rolling: { status: 409, error: "Le MJ n'a pas demandé les jets d'initiative." },
  no_character: { status: 403, error: "Aucun personnage à toi dans cette campagne." },
  not_in_combat: { status: 403, error: "Ton personnage n'est pas dans ce combat." },
  out_of_range: { status: 400, error: "Initiative hors bornes (−10 à 40)." },
  refused: { status: 403, error: "Initiative refusée." },
} as const;

/**
 * V3.1-103 (ADR 0040) — une joueuse écrit l'initiative de son PJ pendant les
 * jets d'initiative. Pas la garde des routes de combat (réservées au MJ) :
 * la barrière est `public.set_own_initiative`, qui n'accepte que le PJ
 * réclamé par l'appelant, et seulement en statut `rolling`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = myInitiativeSchema.safeParse(body);
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

  const result = await setMyInitiative(supabase, {
    ...parsedParams.data,
    userId: user.id,
    locale: (await getLocale()) as Locale,
    input: parsed.data,
  });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ initiative: result.initiative, participantId: result.participantId, natural: result.natural }, { status: 200 });
}
