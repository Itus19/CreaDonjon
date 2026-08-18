import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listMonstersForRuleset } from "@/src/server/services/encounters";
import type { Locale } from "@/src/i18n/request";

/**
 * Catalogue de monstres du ruleset par defaut du monde (V1-E3,
 * specs/outils-mj.md §4.2) — panneau de recherche/parcours de l'outil MJ
 * « Générateur de rencontres ». Meme motif que
 * rules/encounter-budget/route.ts : liste vide (pas d'erreur) si le monde
 * n'a pas de ruleset assigne.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
  if (!rulesetId) {
    return NextResponse.json({ monsters: [] }, { status: 200 });
  }

  const monsters = await listMonstersForRuleset(supabase, rulesetId, locale);
  return NextResponse.json({ monsters }, { status: 200 });
}
