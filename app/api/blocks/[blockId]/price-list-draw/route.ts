import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { drawPriceListForBlock } from "@/src/server/services/priceListDraw";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ blockId: z.guid() });
/** Aucun champ attendu : tout vient du bloc et du lieu. Un corps inattendu est refusé plutôt qu'ignoré. */
const zBody = z.object({}).strict();

const MESSAGES = {
  not_found: { status: 404, error: "Bloc introuvable." },
  not_a_price_list: { status: 400, error: "Ce bloc n'est pas une carte." },
  forbidden: { status: 403, error: "Tu ne peux pas modifier cette fiche." },
  no_generators: { status: 404, error: "Ce monde n'a pas encore de générateurs." },
  no_menu: { status: 404, error: "Le générateur Taverne n'a pas de section « Menu »." },
} as const;

/**
 * V3.2-9 (ADR 0110) — « Tirer la carte » d'un bloc « Carte et tarifs ». Rend
 * la carte tirée sans l'écrire : l'éditeur l'enregistre par le chemin
 * ordinaire des blocs. Aucun hasard côté client (règle absolue 8) : la graine
 * vient de l'identifiant du lieu, côté serveur.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  const body = await request.json().catch(() => ({}));
  const parsedBody = zBody.safeParse(body ?? {});
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;
  const result = await drawPriceListForBlock(supabase, { blockId: parsedParams.data.blockId, userId: user.id, locale });
  if ("error" in result) {
    const { status, error } = MESSAGES[result.error];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ data: result.data }, { status: 200 });
}
