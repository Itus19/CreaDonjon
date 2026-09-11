import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { castSpellSchema } from "@/lib/characterActions/schemas";
import { castSpell } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  item_not_found: "Ce sort n'est pas connu par ce personnage.",
  not_a_weapon: "Erreur inattendue.",
  not_a_spellcaster: "Erreur inattendue.",
  no_slot_available: "Aucun emplacement disponible à ce niveau.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = castSpellSchema.safeParse(body);
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

  const locale = (await getLocale()) as Locale;
  const result = await castSpell(supabase, {
    entityId,
    campaignId: parsed.data.campaignId,
    spellKey: parsed.data.spellKey,
    slotLevel: parsed.data.slotLevel,
    critical: parsed.data.critical,
    actorUserId: user.id,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
