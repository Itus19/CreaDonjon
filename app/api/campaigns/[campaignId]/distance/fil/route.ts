import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { REMOTE_ERRORS } from "@/lib/remote/erreurs";
import { loadRemoteTable } from "@/src/server/services/remotePlay";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid() });

/**
 * ADR 0103 — le fil du jeu à distance, tel que l'appelant a le droit de le
 * lire (RLS). Appelée au premier affichage par la page, puis seulement
 * quand le temps réel signale un changement (QUOTAS Q2) : jamais sondée.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const result = await loadRemoteTable(supabase, { campaignId: parsed.data.campaignId, userId: user.id, locale: (await getLocale()) as Locale });
  if (!result.ok) {
    const { status, error } = REMOTE_ERRORS[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(result.view, { status: 200 });
}
