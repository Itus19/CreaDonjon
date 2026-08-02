import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";
import RulesSidebar from "@/components/rules/RulesSidebar";
import Panel from "@/components/shell/Panel";

export default async function ReglesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const locale = (await getLocale()) as Locale;
  const entries = await listRuleEntriesForWorld(supabase, worldSlug, locale);
  if (entries === null) notFound();

  return (
    <>
      <RulesSidebar worldSlug={worldSlug} entries={entries} />
      <div className="flex-1 overflow-y-auto p-8">
        <Panel>{children}</Panel>
      </div>
    </>
  );
}
