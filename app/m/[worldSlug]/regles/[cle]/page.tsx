import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRuleEntryPageData } from "@/src/server/services/rules";
import type { Locale } from "@/src/i18n/request";
import type { ActionsBlockData, StatBlockBlockData, TraitsBlockData } from "@/src/core/schemas/rule-blocks";
import RuleBlockRenderer from "@/components/rules/RuleBlockRenderer";
import { MonsterCard } from "@/components/rules/blockContentRenderer";
import MissingBlocksBanner from "@/components/rules/MissingBlocksBanner";
import RuleRefsPanel from "@/components/rules/RuleRefsPanel";
import RefPathHighlighter from "@/components/rules/RefPathHighlighter";

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

  const t = await getTranslations("regles");
  const entryTypeLabels = t.raw("entryTypes") as Record<string, string>;

  // Fiche de creature (V1-E4 suite, retour utilisateur) : stat_block,
  // traits et actions fusionnes dans UN seul bloc visuel (MonsterCard)
  // plutot que trois sections separees — jamais d'onglets, Actions puis
  // Aptitudes speciales a la suite. traits/actions sont retires de la
  // boucle normale quand un stat_block existe dans la meme fiche ; sans
  // stat_block (rare, un type de bloc n'est pas reserve aux monstres), ils
  // restent rendus par RuleBlockRenderer comme avant (Traits/Actions,
  // blockContentRenderer.tsx).
  const statBlockEntry = entry.blocks.find((b) => b.blockType === "stat_block");
  const traitsEntry = entry.blocks.find((b) => b.blockType === "traits");
  const actionsEntry = entry.blocks.find((b) => b.blockType === "actions");
  const mergedIds = statBlockEntry ? new Set([traitsEntry?.id, actionsEntry?.id].filter((id): id is string => !!id)) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Meme grille que la fiche d'entite (EditEntityForm.tsx) : titre +
          type a gauche, espace d'image a droite, meme largeur/ratio. */}
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

      {/* Renvois places juste avant "Donnees brutes (SRD)", jamais apres
          (V1-D7, retour utilisateur) : custom_table porte toujours le plus
          grand display_order (900, scripts/ingest-srd.ts), donc le separer
          du reste suffit a l'isoler en fin de liste sans trier a la main. */}
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

      <Suspense fallback={null}>
        <RefPathHighlighter />
      </Suspense>
    </div>
  );
}
