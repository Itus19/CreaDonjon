import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { addParticipantSchema } from "@/lib/combats/schemas";
import { addCustomParticipant, addEntityParticipant, addStatblockParticipant } from "@/src/server/services/combats";
import type { Locale } from "@/src/i18n/request";

/** "+ Ajouter" (V1-E4) — un PJ/PNJ nomme, un monstre du ruleset, ou une saisie libre (specs/outils-mj.md §5.1). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const { campaignId, combatId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = addParticipantSchema.safeParse(body);
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

  if (parsed.data.sourceKind === "entity") {
    const locale = (await getLocale()) as Locale;
    const participant = await addEntityParticipant(supabase, {
      combatId,
      entityId: parsed.data.entityId,
      campaignId,
      locale,
      isAlly: parsed.data.isAlly,
    });
    if (!participant) {
      return NextResponse.json({ error: "Entite introuvable ou sans fiche de personnage." }, { status: 404 });
    }
    return NextResponse.json(participant, { status: 201 });
  }

  if (parsed.data.sourceKind === "statblock") {
    const participant = await addStatblockParticipant(supabase, {
      combatId,
      campaignId,
      entryKey: parsed.data.entryKey,
      label: parsed.data.label,
      isAlly: parsed.data.isAlly,
    });
    if (!participant) {
      return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
    }
    return NextResponse.json(participant, { status: 201 });
  }

  const participant = await addCustomParticipant(supabase, { combatId, label: parsed.data.label, isAlly: parsed.data.isAlly });
  return NextResponse.json(participant, { status: 201 });
}
