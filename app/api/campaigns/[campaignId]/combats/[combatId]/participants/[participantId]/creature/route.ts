import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getControlledCreatureCharacteristics } from "@/src/server/services/controlledCreature";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), combatId: z.string().uuid(), participantId: z.string().uuid() });

/**
 * V3.1-184 (ADR 0078) — une joueuse lit la créature qu'elle pilote (invoquée
 * par son PJ) pour la faire agir : son bloc de stats et ses actions. La route
 * des caractéristiques reste au MJ ; celle-ci ne répond que pour une ligne dont
 * `controlled_by` est l'appelante, relu par la lecture signée du moteur.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string; participantId: string }> }) {
  const adresse = zParams.safeParse(await params);
  if (!adresse.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const caracteristiques = await getControlledCreatureCharacteristics(supabase, { ...adresse.data, userId: user.id, locale: (await getLocale()) as Locale });
    if (!caracteristiques) return NextResponse.json({ error: "Cette créature n'est pas la vôtre." }, { status: 404 });
    return NextResponse.json(caracteristiques, { status: 200 });
  } catch (erreur) {
    // Lecture signée refusée (pas membre de la campagne, clé du moteur absente) : jamais muet.
    console.error("Lecture de la créature pilotée en échec", erreur);
    return NextResponse.json({ error: "Impossible de lire cette créature." }, { status: 503 });
  }
}
