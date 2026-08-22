import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpikeSetup } from "@/src/server/services/spikeSolo";
import type { Locale } from "@/src/i18n/request";

/** V2-S1 : etat initial du spike (lieu, PNJ, personnage, rencontre preparee) — lecture seule. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;
  const setup = await getSpikeSetup(supabase, locale);
  return NextResponse.json(setup, { status: 200 });
}
