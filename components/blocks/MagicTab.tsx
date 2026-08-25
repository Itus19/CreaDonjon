"use client";

import { useState } from "react";
import Link from "next/link";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { SpellCastingBlockData } from "@/src/core/schemas/rule-blocks";
import { MAGIC_SCHOOL_LABELS_FR, MAGIC_SCHOOL_COLOR_VAR } from "@/src/i18n/fr";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "./useRuleEntryBlocks";

export interface KnownSpellView {
  known: { ref: BlockReference };
  label: string;
  level: number;
}

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

/**
 * Encadre d'un sort connu (retour utilisateur, ajout de l'onglet Magie en
 * cartes) : meme langage visuel qu'`ItemCard` (InventoryPanel.tsx), demande
 * explicitement plutot qu'un style invente — bandeau vertical a gauche
 * ("Préparé"/"Préparer" au lieu d'"Équipé"/"Équiper"), titre+badges a droite,
 * bandeau de pliage en tete pour la description complete. Pas le meme
 * composant (les donnees n'ont rien en commun — poids/valeur d'un objet
 * contre ecole/temps d'incantation d'un sort), mais le meme squelette.
 *
 * `casting`/`descriptionBlocks` viennent du bloc de regle `spell_casting` du
 * sort (V1-D3), recupere en lot par `useRuleEntryBlocks` — jamais stockes
 * sur le personnage, seulement lus a l'affichage, meme motif que les
 * proprietes d'arme dans `ItemCard`.
 */
function SpellCard({
  worldSlug,
  spell,
  chip,
  blocks,
  isPrepared,
  onTogglePrepared,
}: {
  worldSlug: string;
  spell: KnownSpellView;
  chip: ResolvedChipView | undefined;
  blocks: RuleEntryBlockData[] | undefined;
  isPrepared: boolean;
  onTogglePrepared: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const title = chip?.found ? chip.name : spell.label;
  const casting = findBlock<SpellCastingBlockData>(blocks, "spell_casting");
  const descriptionBlocks = blocks?.filter((b) => b.blockType === "description") ?? [];
  const hasCollapsibleContent = descriptionBlocks.length > 0;

  const school = casting
    ? { label: MAGIC_SCHOOL_LABELS_FR[casting.school] ?? casting.school, colorVar: MAGIC_SCHOOL_COLOR_VAR[casting.school] ?? "--link-rule" }
    : null;

  // Memes etiquettes que le bloc `spell_casting` generique
  // (blockContentRenderer.tsx, composant SpellCasting) — mais en pastilles
  // courtes façon proprietes d'arme, jamais une deuxieme liste key/value.
  const tags = casting
    ? [
        casting.casting_time,
        casting.range,
        casting.concentration ? `${casting.duration} (concentration)` : casting.duration,
        casting.material ? `${casting.components.join(", ")} (${casting.material})` : casting.components.join(", "),
        ...(casting.ritual ? ["Rituel"] : []),
      ]
    : [];

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-edge/60 bg-panel-raised">
      {hasCollapsibleContent && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Déplier" : "Replier"}
          aria-label={collapsed ? "Déplier" : "Replier"}
          className="flex w-full items-center justify-center border-b border-edge/60 bg-panel py-px text-xs leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
        >
          {collapsed ? "▾" : "▴"}
        </button>
      )}
      <div className="flex">
        <button
          type="button"
          onClick={onTogglePrepared}
          title={isPrepared ? "Cliquer pour ne plus préparer" : "Cliquer pour préparer"}
          className={`w-7 shrink-0 border-r text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            isPrepared ? "border-accent/50 bg-accent/20 text-accent" : "border-edge/60 bg-panel text-ink-muted hover:bg-panel-raised"
          }`}
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {isPrepared ? "Préparé" : "Préparer"}
        </button>
        <div className={`flex min-w-0 flex-1 flex-col gap-1.5 px-2.5 pb-2.5 ${hasCollapsibleContent ? "pt-1.5" : "pt-2.5"}`}>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {chip?.found ? (
                <Link
                  href={chip.href}
                  className="truncate text-sm font-semibold no-underline hover:underline"
                  style={{ color: "var(--link-rule)" }}
                >
                  {title}
                </Link>
              ) : (
                <span className="truncate text-sm font-semibold text-ink">{title}</span>
              )}
              {school && (
                <span
                  className="shrink-0 rounded-full border px-1.5 py-0 text-[10px]"
                  style={{ borderColor: `var(${school.colorVar})`, color: `var(${school.colorVar})` }}
                >
                  {school.label}
                </span>
              )}
            </div>
            <span className="mech w-12 shrink-0 text-right text-ink-muted" style={{ fontSize: "0.625rem" }}>
              {spell.level === 0 ? "Tour" : `Niv. ${spell.level}`}
            </span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <span key={i} className="rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {!collapsed && descriptionBlocks.length > 0 && (
            <div className="text-xs leading-relaxed text-ink-muted">
              {descriptionBlocks.map((b, i) => (
                <div key={i}>{renderBlockData("description", b.data, worldSlug)}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Onglet Magie de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5 — pur decoupage, aucun changement de
 * comportement) : sorts connus tries par niveau, bascule « Prepare ».
 * Cartes `SpellCard` (retour utilisateur suite) plutot que la liste a case a
 * cocher d'origine — meme langage visuel que l'onglet Inventaire.
 */
export default function MagicTab({
  worldSlug,
  sortedKnownSpells,
  spellChips,
  spellcasting,
  onTogglePrepared,
}: {
  worldSlug: string;
  sortedKnownSpells: KnownSpellView[];
  spellChips: Map<string, ResolvedChipView>;
  spellcasting: SpellcastingBlockData;
  onTogglePrepared: (key: string) => void;
}) {
  const knownRuleKeys = sortedKnownSpells
    .map((s) => (s.known.ref.kind === "rule" ? s.known.ref.key : null))
    .filter((k): k is string => k !== null);
  const blocksByKey = useRuleEntryBlocks(worldSlug, knownRuleKeys);

  return (
    <div className="flex flex-col gap-2 pt-3">
      <p className="text-[10px] italic text-ink-muted">
        Sorts connus, triés par niveau. Préparez-les pour les retrouver dans l&apos;onglet Actions.
      </p>
      {sortedKnownSpells.map((spell) => {
        const ruleKey = spell.known.ref.kind === "rule" ? spell.known.ref.key : null;
        return (
          <SpellCard
            key={refIdentity(spell.known.ref)}
            worldSlug={worldSlug}
            spell={spell}
            chip={spellChips.get(refIdentity(spell.known.ref))}
            blocks={ruleKey ? blocksByKey[ruleKey] : undefined}
            isPrepared={ruleKey !== null && spellcasting.prepared.includes(ruleKey)}
            onTogglePrepared={() => ruleKey && onTogglePrepared(ruleKey)}
          />
        );
      })}
      {sortedKnownSpells.length === 0 && <p className="text-sm text-ink-muted">Aucun sort connu.</p>}
    </div>
  );
}
