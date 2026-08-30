import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";
import RuleEntryView from "@/components/rules/RuleEntryView";

/** Reutilise `RuleEntryView` tel quel (deja en lecture seule — une regle officielle ne se modifie jamais) — jamais `RegisterPrimaryWindow`/fenetres flottantes, hors de propos ici. */
export default async function JoueurRuleEntryPage({
  params,
}: {
  params: Promise<{ worldSlug: string; cle: string }>;
}) {
  const { worldSlug, cle } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entry = await getRuleEntryPageData(supabase, worldSlug, cle, locale);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/m/${worldSlug}/joueur/regles`} className="text-xs text-ink-muted hover:text-ink">
        ← Règles
      </Link>
      <RuleEntryView entry={entry} worldSlug={worldSlug} />
    </div>
  );
}
