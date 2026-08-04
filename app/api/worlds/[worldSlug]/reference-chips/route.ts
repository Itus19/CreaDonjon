import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveChipsSchema } from "@/lib/referenceChips/schemas";
import { resolveBlockReferences } from "@/src/server/services/referenceChips";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import type { Locale } from "@/src/i18n/request";

/**
 * Resolution en lot de `BlockReference` en fiches d'affichage pour
 * `<RuleChip>`/`<EntityChip>` (V1-B2, specs/wiki-blocs.md §4.3) — appelee
 * cote client par les editeurs de blocs personnage des qu'ils ont besoin
 * d'afficher le nom/lien d'une reference stockee (espece, objet, sort...).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = resolveChipsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const [rulesetId, locale] = await Promise.all([
    getWorldDefaultRulesetId(supabase, world.id),
    getLocale() as Promise<Locale>,
  ]);

  const chips = await resolveBlockReferences(supabase, world, rulesetId, locale, parsed.data.refs);
  return NextResponse.json({ chips }, { status: 200 });
}
