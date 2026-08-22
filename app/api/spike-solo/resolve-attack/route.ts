import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveMonsterAttackOnBram } from "@/src/server/services/spikeSolo";
import type { Locale } from "@/src/i18n/request";

const bodySchema = z.object({ monsterEntryKey: z.string().min(1) });

/** V2-S1 : resolution mecanique reelle (jamais par le modele) — jamais d'ecriture en base, le PV se suit cote client. */
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
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;
  const result = await resolveMonsterAttackOnBram(supabase, parsed.data.monsterEntryKey, locale);
  return NextResponse.json(result, { status: 200 });
}
