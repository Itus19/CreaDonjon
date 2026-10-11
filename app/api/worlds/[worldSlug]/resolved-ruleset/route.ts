import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRulesetSchema } from "@/lib/resolvedRuleset/schemas";
import { buildResolvedRulesetView } from "@/src/server/services/resolvedRuleset";
import { getWorldBySlug } from "@/src/server/services/worlds";
import type { Locale } from "@/src/i18n/request";

/**
 * Assemble un `ResolvedRuleset` reel (V1-B4) pour l'espece/l'historique/les
 * classes donnees — appele cote client par l'apercu vivant de la fiche des
 * que ces champs changent (pas a chaque frappe sur les caracteristiques,
 * qui se recalculent localement avec le meme resultat en cache).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = resolveRulesetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  return NextResponse.json(await buildResolvedRulesetView(supabase, world.id, parsed.data, locale), { status: 200 });
}
