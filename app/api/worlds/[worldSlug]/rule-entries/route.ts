import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

/**
 * Liste complete des entrees du ruleset d'un monde (V1-B2, autocompletion
 * des champs de reference) — meme fonction que la barre laterale Regles
 * (V1-A1), simplement exposee en JSON pour un fetch client. Filtree par
 * type et par frappe cote client (`RuleEntryAutocomplete`), pas ici : meme
 * convention que `RulesSidebar` (filtre en memoire, pas de recherche
 * serveur pour quelques milliers d'entrees).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;

  const entries = await listRuleEntriesForWorld(supabase, worldSlug, locale);
  if (entries === null) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }
  return NextResponse.json({ entries }, { status: 200 });
}
