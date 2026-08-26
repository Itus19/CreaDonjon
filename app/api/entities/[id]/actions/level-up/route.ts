import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { applyLevelUpSchema } from "@/lib/characterActions/schemas";
import { applyLevelUp, type ApplyLevelUpError } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";

const ERROR_MESSAGES: Record<ApplyLevelUpError, string> = {
  not_found: "Fiche de personnage introuvable ou sans ruleset resolvable.",
  conflict: "Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.",
  invalid_level_change: "Les niveaux ne peuvent que monter, jamais descendre.",
  invalid_asi: "Choix d'amélioration de caractéristique invalide.",
  invalid_hp_choice: "Choix de points de vie manquant ou incohérent avec les niveaux gagnés.",
  xp_insufficient: "Le total de PX actuel ne justifie plus cette montée de niveau.",
  forbidden_field_change: "La montée de niveau ne peut pas changer l'espèce, l'historique ou l'identité du personnage.",
};

const STATUS_BY_ERROR: Partial<Record<ApplyLevelUpError, number>> = {
  not_found: 404,
  conflict: 409,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = applyLevelUpSchema.safeParse(body);
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
  const result = await applyLevelUp(supabase, {
    entityId,
    campaignId: parsed.data.campaignId,
    expectedVersion: parsed.data.expectedVersion,
    character: parsed.data.character,
    spellcasting: parsed.data.spellcasting,
    hpChoices: parsed.data.hpChoices,
    actorUserId: user.id,
    locale,
  });

  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: STATUS_BY_ERROR[result.error] ?? 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
