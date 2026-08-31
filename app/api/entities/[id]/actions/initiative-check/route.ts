import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { initiativeCheckSchema } from "@/lib/characterActions/schemas";
import { rollInitiativeCheck } from "@/src/server/services/checkRolls";
import type { Locale } from "@/src/i18n/request";

const REASON_STATUS = { not_found: 404, forbidden: 403 } as const;
const REASON_MESSAGE = {
  not_found: "Fiche de personnage introuvable ou sans ruleset resolvable.",
  forbidden: "Vous n'avez pas le droit de rouler pour cette fiche.",
} as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = initiativeCheckSchema.safeParse(body);
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
  const result = await rollInitiativeCheck(supabase, {
    entityId,
    campaignId: parsed.data.campaignId,
    callerId: user.id,
    advantage: parsed.data.advantage,
    dc: parsed.data.dc,
    hidden: parsed.data.hidden,
    locale,
  });

  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] }, { status: REASON_STATUS[result.reason] });
  }
  return NextResponse.json(result.roll, { status: 200 });
}
