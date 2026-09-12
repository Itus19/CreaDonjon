"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { ActionsBlockData, LegendaryActionsBlockData, StatBlockBlockData, TraitsBlockData } from "@/src/core/schemas/rule-blocks";
import RuleBlockRenderer from "@/components/rules/RuleBlockRenderer";
import { MonsterCard } from "@/components/rules/blockContentRenderer";
import MissingBlocksBanner from "@/components/rules/MissingBlocksBanner";
import RuleRefsPanel from "@/components/rules/RuleRefsPanel";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

/** Coquille joueur (retour utilisateur : "les blocs de données brutes SRD ne sont pas visibles par défaut" — puis, sur un `<details>` replie : "le titre... est toujours visible") — retires ENTIEREMENT pour un joueur (jamais juste replies, un `<summary>` reste visible par nature), toujours visibles pour le MJ. Tables techniques telles quelles, jamais mises en recit — le contenu narratif (description, traits, actions...) n'est jamais concerne. */
const RAW_DATA_BLOCK_TYPES = new Set(["custom_table", "class_progression", "spellcasting_progression"]);

/**
 * Contenu d'une fiche de regle, partage entre le rendu serveur de la
 * fenetre primaire (`regles/[cle]/page.tsx`) et la recuperation client
 * d'une fenetre secondaire `?avec=` (ADR-0011) — meme motif que
 * `EditEntityForm` pour les entites. Traductions via le hook client
 * (`useTranslations`), la variante serveur de la page utilisant
 * `getTranslations` produit le meme resultat.
 */
export default function RuleEntryView({
  entry,
  worldSlug,
  playerRestricted,
}: {
  entry: RuleEntryDetail;
  worldSlug: string;
  /** Coquille joueur — voir `RAW_DATA_BLOCK_TYPES` ci-dessus. */
  playerRestricted?: boolean;
}) {
  const t = useTranslations("regles");
  const router = useRouter();
  const entryTypeLabels = t.raw("entryTypes") as Record<string, string>;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/regles/${entry.entryKey}/disable`, { method: "POST" });
    setDeleting(false);
    setConfirmingDelete(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setDeleteError(body?.error ?? "Impossible de supprimer cette fiche.");
      return;
    }
    router.push(`/m/${worldSlug}/regles`);
    router.refresh();
  }

  const statBlockEntry = entry.blocks.find((b) => b.blockType === "stat_block");
  const traitsEntry = entry.blocks.find((b) => b.blockType === "traits");
  const actionsEntry = entry.blocks.find((b) => b.blockType === "actions");
  const legendaryActionsEntry = entry.blocks.find((b) => b.blockType === "legendary_actions");
  const mergedIds = statBlockEntry
    ? new Set([traitsEntry?.id, actionsEntry?.id, legendaryActionsEntry?.id].filter((id): id is string => !!id))
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className={playerRestricted ? "flex flex-col" : "grid grid-cols-[1fr_auto] gap-6"}>
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
              {!playerRestricted && entry.isHomebrew && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="whitespace-nowrap text-xs text-danger hover:underline"
                  title="Supprimer cette fiche maison"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
          {entry.sourceAttribution && (
            <span className="mt-0.5 font-mech text-xs text-ink-muted">{entry.sourceAttribution}</span>
          )}
          {deleteError && <p className="mt-0.5 text-xs text-danger">{deleteError}</p>}
        </div>

        {/* Coquille joueur (retour utilisateur) : "si il n'y en a pas, le
            cadre du portrait vide ne s'affiche pas" — aucune fiche de regle
            n'a de veritable illustration aujourd'hui (`RuleEntryDetail` ne
            porte aucun champ image, contrairement au portrait d'entite,
            meme mecanisme que `PublicPortrait.tsx` : jamais de cadre vide a
            la place d'une image reelle). Le cadre reste visible cote MJ,
            comme un rappel qu'aucune illustration n'existe encore. */}
        {!playerRestricted && (
          <div className="flex aspect-[3/4] w-56 shrink-0 items-center justify-center rounded-2xl border border-edge bg-panel-sunken text-center text-xs text-ink-muted">
            {t("illustration")}
          </div>
        )}
      </div>

      <MissingBlocksBanner missingBlocks={entry.missingBlocks} />

      <div className="flex flex-col">
        {entry.blocks
          .filter(
            (block) =>
              block.blockType !== "custom_table" &&
              !mergedIds?.has(block.id) &&
              !(playerRestricted && RAW_DATA_BLOCK_TYPES.has(block.blockType))
          )
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
        {/* `custom_table` (coquille joueur, retour utilisateur : "le titre
            du bloc Données brutes SRD est toujours visible") — un `<details>`
            replie garde son `<summary>` visible par nature, ce que le
            retour ecarte explicitement : retire entierement le bloc pour
            un joueur plutot que de le replier, jamais pour le MJ. */}
        {!playerRestricted &&
          entry.blocks
            .filter((block) => block.blockType === "custom_table")
            .map((block) => (
              <RuleBlockRenderer key={block.id} block={block} worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} />
            ))}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer cette fiche ?"
        message={`« ${entry.name} » sera retirée de ce ruleset. Cette action ne peut pas être annulée depuis l'interface.`}
        confirmLabel={deleting ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
