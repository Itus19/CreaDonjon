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
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import HomebrewEditForm, { isEditableHomebrewType } from "@/components/rules/HomebrewEditForm";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import { creerVersionMaison, epinglerRegle } from "@/lib/ui/regleApi";
import { entreesMenuRegle, estModifieeDansVariante, lienRegleWiki } from "@/lib/ui/regleEcran";

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
  // V3.1-2 : la fiche maison se modifie EN PLACE, dans son formulaire de
  // creation rouvert ici meme (meme fenetre, meme page) — pas de nouvelle
  // route ni de nouvelle cle de fenetre.
  const [editing, setEditing] = useState(false);
  // Message du dernier geste du menu (confirmation ou erreur du serveur).
  const [geste, setGeste] = useState<{ texte: string; erreur: boolean } | null>(null);
  const typeModifiable = isEditableHomebrewType(entry.entryType);
  const modifieeDansVariante = estModifieeDansVariante(entry.modifiedBlockTypes, entry.houseVersion);

  const entrees = entreesMenuRegle({
    playerRestricted: !!playerRestricted,
    isHomebrew: entry.isHomebrew,
    houseVersion: entry.houseVersion,
    isOfficialBase: entry.isOfficialBase,
    typeModifiable,
  });

  async function epingler() {
    const r = await epinglerRegle(worldSlug, entry.entryKey);
    if (!r.ok) setGeste({ texte: r.message, erreur: true });
    else setGeste({ texte: r.valeur.alreadyPinned ? t("dejaDansBlocNotes") : t("epingleBlocNotes"), erreur: false });
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(lienRegleWiki(window.location.origin, worldSlug, entry.entryKey));
      setGeste({ texte: t("lienCopie"), erreur: false });
    } catch (erreur) {
      console.error("copie du lien de règle", erreur);
      setGeste({ texte: t("copieImpossible"), erreur: true });
    }
  }

  async function creerMaison() {
    const r = await creerVersionMaison(worldSlug, entry.entryKey);
    if (!r.ok) {
      setGeste({ texte: r.message, erreur: true });
      return;
    }
    setGeste(null);
    // Les listes laterales vivent dans un cache du navigateur ; la fiche est relue par le serveur.
    clearWorldRuleEntriesCache(worldSlug);
    relireFiche();
  }

  // Un seul point de rechargement de la fiche (cliquet du cablage, docs/CABLAGE.md §6).
  function relireFiche() {
    router.refresh();
  }

  const libellesEntrees: Record<(typeof entrees)[number], ActionsMenuItem> = {
    epingler: { label: t("epinglerBlocNotes"), onSelect: () => void epingler() },
    copierLien: { label: t("copierLienWiki"), onSelect: () => void copierLien() },
    versionMaison: { label: t("creerVersionMaison"), onSelect: () => void creerMaison() },
    modifier: { label: t("modifier"), onSelect: () => setEditing(true) },
    supprimer: { label: t("supprimer"), onSelect: () => setConfirmingDelete(true), danger: true },
  };

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
    // La liste laterale vit dans un cache du navigateur, que `router.refresh()`
    // ne touchait pas : elle montrait encore la regle supprimee. La page
    // `/regles`, dynamique, est demandee fraiche par la navigation (C5).
    clearWorldRuleEntriesCache(worldSlug);
    router.push(`/m/${worldSlug}/regles`);
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
            {!playerRestricted && modifieeDansVariante && (
              <span className="whitespace-nowrap rounded-full border border-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent">
                {t("modifieeDansTaVariante")}
              </span>
            )}
            {entrees.length > 0 && !editing && (
              <ActionsMenu items={entrees.map((e) => libellesEntrees[e])} aria-label={t("actionsRegle")} />
            )}
          </div>
        </div>
        <span className="mt-0.5 text-sm font-medium text-ink-muted">{entryTypeLabels[entry.entryType] ?? entry.entryType}</span>
        {entry.sourceAttribution && (
          <span className="mt-0.5 font-mech text-xs text-ink-muted">{entry.sourceAttribution}</span>
        )}
        {geste && (
          <p role="status" className={`mt-1 text-xs ${geste.erreur ? "text-danger" : "text-ink-muted"}`}>
            {geste.texte}
          </p>
        )}
        {deleteError && <p className="mt-0.5 text-xs text-danger">{deleteError}</p>}
      </div>

      {editing && (
        <HomebrewEditForm
          worldSlug={worldSlug}
          entryType={entry.entryType}
          entryKey={entry.entryKey}
          onDone={() => {
            setEditing(false);
            relireFiche();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

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
              <RuleBlockRenderer key={block.id} block={block} worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} sansBascule={playerRestricted} />
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
              <RuleBlockRenderer key={block.id} block={block} worldSlug={worldSlug} outgoingRefs={entry.outgoingRefs} sansBascule={playerRestricted} />
            ))}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={t("supprimerTitre")}
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
