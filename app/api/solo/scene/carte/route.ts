import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { drawPriceListForScene, type ScenePriceListError } from "@/src/server/services/priceListDraw";
import type { Locale } from "@/src/i18n/request";

/**
 * V3.2-10 (ADR 0110) — « Tirer la carte du lieu » depuis « Que fais-tu ? ».
 *
 * Tire la carte du lieu de la scène et l'écrit sur sa page de wiki, une fois
 * pour toutes. Le droit est celui d'écrire sur la fiche du lieu
 * (`canUserEditEntityById`, vérifié par le service) : une personne qui joue
 * sans droit d'écriture sur le wiki reçoit un refus, et le MJ tire la carte.
 */
const bodySchema = z.object({ campaignId: z.string().uuid() }).strict();

const STATUS: Record<ScenePriceListError, number> = {
  no_generators: 409,
  no_menu: 409,
  no_scene: 409,
  not_found: 404,
  forbidden: 403,
  write_failed: 500,
};
const MESSAGE: Record<ScenePriceListError, string> = {
  no_generators: "Ce monde n'a pas encore les tables du générateur Taverne.",
  no_menu: "Le générateur Taverne de ce monde n'a pas de section Menu.",
  no_scene: "Aucune scène n'est posée : choisis d'abord le lieu.",
  not_found: "Le lieu de la scène est introuvable.",
  forbidden: "Tu ne peux pas modifier la page de ce lieu : demande au MJ de tirer sa carte.",
  write_failed: "La carte a été tirée, mais n'a pas pu être enregistrée.",
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
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

  const campaign = await getCampaignById(supabase, parsed.data.campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  const outcome = await drawPriceListForScene(supabase, { campaignId: campaign.id, worldId: campaign.world_id, userId: user.id, locale });
  if ("error" in outcome) {
    return NextResponse.json({ error: MESSAGE[outcome.error] }, { status: STATUS[outcome.error] });
  }
  return NextResponse.json({ data: outcome }, { status: 200 });
}
