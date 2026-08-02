import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";

export default async function ReglesHomePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entries = await listRuleEntriesForWorld(supabase, worldSlug, locale);
  const t = await getTranslations("regles");

  if (!entries || entries.length === 0) {
    return <p className="text-sm text-ink-muted">{t("pasDeRuleset")}</p>;
  }

  return <p className="text-sm text-ink-muted">{t("choisirRegle")}</p>;
}
