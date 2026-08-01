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
    <div className="flex flex-col gap-5">
      {/* Meme grille que la fiche d'entite (EditEntityForm.tsx) : titre +
          type a gauche, espace d'image a droite, meme largeur/ratio. */}
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <h1 className="entity-title">{entry.name}</h1>
            <span className="shrink-0 whitespace-nowrap px-1 py-1 text-sm font-medium text-ink-muted">
              {ENTRY_TYPE_LABELS_FR[entry.entryType] ?? entry.entryType}
            </span>
          </div>
          {entry.sourceAttribution && (
            <span className="mt-0.5 font-mech text-xs text-ink-muted">{entry.sourceAttribution}</span>
          )}
        </div>

        <div className="flex aspect-[3/4] w-56 shrink-0 items-center justify-center rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
          Illustration
        </div>
      </div>

      <MissingBlocksBanner missingBlocks={entry.missingBlocks} />

      <div className="flex flex-col">
        {entry.blocks.map((block) => (
          <RuleBlockRenderer key={block.id} block={block} />
        ))}
      </div>
    </div>
  );
}
