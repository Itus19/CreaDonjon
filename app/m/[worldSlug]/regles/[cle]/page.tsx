import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isPlayerOnlyInWorld } from "@/src/server/services/permissions";
import type { Locale } from "@/src/i18n/request";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import RuleEntryView from "@/components/rules/RuleEntryView";
import RefPathHighlighter from "@/components/rules/RefPathHighlighter";

/** Retour utilisateur : "quand un joueur utilise les hyperliens... ils arrivent dans un écran de MJ" — meme garde que `(monde)/f/[entitySlug]/page.tsx`, voir sa documentation. */
export default async function RuleEntryPage({
  params,
}: {
  params: Promise<{ worldSlug: string; cle: string }>;
}) {
  const { worldSlug, cle } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entry = await getRuleEntryPageData(supabase, worldSlug, cle, locale);
  if (!entry) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const world = await getWorldBySlug(supabase, worldSlug);
    if (world && (await isPlayerOnlyInWorld(supabase, { worldId: world.id, userId: user.id }))) {
      redirect(`/m/${worldSlug}/joueur/regles/${cle}`);
    }
  }

  const t = await getTranslations("regles");
  const entryTypeLabels = t.raw("entryTypes") as Record<string, string>;

  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "rule", key: entry.entryKey }}
        name={entry.name}
        badge={entryTypeLabels[entry.entryType] ?? entry.entryType}
        homeHref={`/m/${worldSlug}/regles`}
      />
      <RuleEntryView entry={entry} worldSlug={worldSlug} />
      <Suspense fallback={null}>
        <RefPathHighlighter />
      </Suspense>
    </>
  );
}
