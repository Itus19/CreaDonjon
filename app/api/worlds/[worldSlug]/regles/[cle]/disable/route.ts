import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disableRulesetEntry, getRuleEntryPageData } from "@/src/server/services/rules";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import type { Locale } from "@/src/i18n/request";
import { getLocale } from "next-intl/server";

/**
 * "Supprimer cette fiche" (retour utilisateur, suite V2-J4) — reserve aux
 * fiches maison (`isHomebrew`, `RuleEntryDetail`) : une fiche officielle ou
 * heritee n'a jamais ce bouton cote client, et cette route revalide la
 * meme condition cote serveur avant d'ecrire quoi que ce soit (jamais une
 * confiance aveugle en ce que le client affiche). Cible toujours le
 * ruleset ACTIF du monde — la seule variante ou une fiche maison peut
 * exister dans ce modele (une variante fork toujours directement un
 * officiel, jamais une autre variante).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string; cle: string }> }) {
  const { worldSlug, cle } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  const entry = await getRuleEntryPageData(supabase, worldSlug, cle, locale);
  if (!entry) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  if (!entry.isHomebrew) {
    return NextResponse.json({ error: "Seule une fiche maison peut être supprimée." }, { status: 403 });
  }

  const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
  if (!rulesetId) {
    return NextResponse.json({ error: "Aucun ruleset actif pour ce monde." }, { status: 404 });
  }

  const result = await disableRulesetEntry(supabase, { rulesetId, entryKey: cle });
  if (result === "not_found") {
    return NextResponse.json({ error: "Ruleset introuvable." }, { status: 404 });
  }
  if (result === "official") {
    return NextResponse.json({ error: "Un ruleset officiel n'est jamais modifiable." }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
