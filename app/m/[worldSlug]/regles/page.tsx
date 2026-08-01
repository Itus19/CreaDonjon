import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";

export default async function ReglesHomePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const entries = await listRuleEntriesForWorld(supabase, worldSlug);
  const t = await getTranslations("regles");

  if (!entries || entries.length === 0) {
    return <p className="text-sm text-ink-muted">{t("pasDeRuleset")}</p>;
  }

  return <p className="text-sm text-ink-muted">{t("choisirRegle")}</p>;
}
