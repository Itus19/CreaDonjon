import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listRuleEntriesForWorld } from "@/src/server/services/rules";
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
  const entries = await listRuleEntriesForWorld(supabase, worldSlug);
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
