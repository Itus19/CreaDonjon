import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import { ENTRY_TYPE_LABELS_FR } from "@/src/i18n/fr";
import RuleBlockRenderer from "@/components/rules/RuleBlockRenderer";
import MissingBlocksBanner from "@/components/rules/MissingBlocksBanner";

export default async function RuleEntryPage({
  params,
}: {
  params: Promise<{ worldSlug: string; cle: string }>;
}) {
  const { worldSlug, cle } = await params;
  const supabase = await createClient();
  const entry = await getRuleEntryPageData(supabase, worldSlug, cle);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="entity-title">{entry.name}</h1>
          <span className="mech rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
            {ENTRY_TYPE_LABELS_FR[entry.entryType] ?? entry.entryType}
          </span>
        </div>
        {entry.sourceAttribution && (
          <p className="text-xs text-ink-muted">{entry.sourceAttribution}</p>
        )}
      </header>

      <MissingBlocksBanner missingBlocks={entry.missingBlocks} />

      <div className="flex flex-col">
        {entry.blocks.map((block) => (
          <RuleBlockRenderer key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}
