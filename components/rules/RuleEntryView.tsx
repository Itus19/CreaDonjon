"use client";

import { useTranslations } from "next-intl";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { ActionsBlockData, LegendaryActionsBlockData, StatBlockBlockData, TraitsBlockData } from "@/src/core/schemas/rule-blocks";
import RuleBlockRenderer from "@/components/rules/RuleBlockRenderer";
import { MonsterCard } from "@/components/rules/blockContentRenderer";
import MissingBlocksBanner from "@/components/rules/MissingBlocksBanner";
import RuleRefsPanel from "@/components/rules/RuleRefsPanel";

/**
 * Contenu d'une fiche de regle, partage entre le rendu serveur de la
 * fenetre primaire (`regles/[cle]/page.tsx`) et la recuperation client
 * d'une fenetre secondaire `?avec=` (ADR-0011) — meme motif que
 * `EditEntityForm` pour les entites. Traductions via le hook client
 * (`useTranslations`), la variante serveur de la page utilisant
 * `getTranslations` produit le meme resultat.
 */
export default function RuleEntryView({ entry, worldSlug }: { entry: RuleEntryDetail; worldSlug: string }) {
  const t = useTranslations("regles");
  const entryTypeLabels = t.raw("entryTypes") as Record<string, string>;

  const statBlockEntry = entry.blocks.find((b) => b.blockType === "stat_block");
  const traitsEntry = entry.blocks.find((b) => b.blockType === "traits");
  const actionsEntry = entry.blocks.find((b) => b.blockType === "actions");
  const legendaryActionsEntry = entry.blocks.find((b) => b.blockType === "legendary_actions");
  const mergedIds = statBlockEntry
    ? new Set([traitsEntry?.id, actionsEntry?.id, legendaryActionsEntry?.id].filter((id): id is string => !!id))
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <h1 className="entity-title">{entry.name}</h1>
            <div className="flex shrink-0 items-center gap-2">
              {entry.personalReference && (
                <span
                  className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                  title={t("referencePersonnelleFicheTitre")}
                >
                  {t("referencePersonnelle")}
                </span>
              )}
              <span className="whitespace-nowrap px-1 py-1 text-sm font-medium text-ink-muted">
                {entryTypeLabels[entry.entryType] ?? entry.entryType}
              </span>
            </div>
          </div>
          {entry.sourceAttribution && (
            <span className="mt-0.5 font-mech text-xs text-ink-muted">{entry.sourceAttribution}</span>
          )}
        </div>

        <div className="flex aspect-[3/4] w-56 shrink-0 items-center justify-center rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
          {t("illustration")}
        </div>
      </div>

      <MissingBlocksBanner missingBlocks={entry.missingBlocks} />

      <div className="flex flex-col">
        {entry.blocks
          .filter((block) => block.blockType !== "custom_table" && !mergedIds?.has(block.id))
          .map((block) =>
            statBlockEntry && block.id === statBlockEntry.id ? (
              <div key={block.id} className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0">
                <h3 className="block-title mb-2">{block.display.label}</h3>
                <MonsterCard
                  statBlock={block.data as StatBlockBlockData}
                  traits={traitsEntry?.data as TraitsBlockData | undefined}
                  actions={actionsEntry?.data as ActionsBlockData | undefined}
                  legendaryActions={legendaryActionsEntry?.data as LegendaryActionsBlockData | undefined}
                />
              </div>
            ) : (
              <RuleBlockRenderer key={block.id} block={block} worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} />
            )
          )}
        <RuleRefsPanel worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} incomingRefs={entry.incomingRefs} />
        {entry.blocks
          .filter((block) => block.blockType === "custom_table")
          .map((block) => (
            <RuleBlockRenderer key={block.id} block={block} worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} />
          ))}
      </div>
    </div>
  );
}
