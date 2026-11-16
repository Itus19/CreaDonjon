import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hideParticipantSchema } from "@/lib/combats/schemas";
import { hideParticipant } from "@/src/server/services/combatHide";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), combatId: z.string().uuid() });

const MESSAGES = {
  not_found: { status: 404, error: "Combat ou participant introuvable." },
  not_running: { status: 409, error: "Le combat n'est pas en cours." },
  no_character: { status: 403, error: "Aucun personnage à toi dans cette campagne." },
  not_yours: { status: 403, error: "Tu ne caches que ton personnage." },
} as const;

/**
 * V3.1-181 (ADR 0078) — Se cacher. Pas la garde des routes de combat (réservées
 * au MJ) : le MJ fait cacher tout le monde, une joueuse son seul PJ ; le
 * service le revérifie, lance le test côté serveur et écrit par changement signé.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = hideParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const result = await hideParticipant(supabase, {
    ...parsedParams.data,
    participantId: parsed.data.participantId,
    userId: user.id,
    locale: (await getLocale()) as Locale,
  });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
