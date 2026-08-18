import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { generateEncounterSchema } from "@/lib/encounters/schemas";
import { generateEncounterForCampaign } from "@/src/server/services/encounters";
import { serverRng } from "@/src/server/services/rng";
import { EncounterBudgetLevelError } from "@/src/core/rules/encounter";
import type { Locale } from "@/src/i18n/request";

/**
 * Solveur aleatoire (V1-E3, specs/outils-mj.md §4.3, bouton "Génération
 * Aléatoire" du mockup) — ne sauvegarde rien, ne fait que composer une
 * proposition ; c'est l'appel a POST /encounters (avec le meme corps) qui
 * la fige dans "Mes combats". `serverRng` (crypto.randomInt), meme
 * discipline que le tirage sur table (V1-E1) — jamais Math.random().
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = generateEncounterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;

  try {
    const result = await generateEncounterForCampaign(supabase, campaignId, parsed.data, locale, serverRng);
    if (!result.ok) {
      if (result.reason === "campaign_not_found") {
        return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
      }
      return NextResponse.json({ error: "Budget de rencontre indisponible pour le ruleset de cette campagne." }, { status: 400 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof EncounterBudgetLevelError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
