"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ClassProgressionBlockData, CustomTableBlockData, SpellcastingProgressionBlockData } from "@/src/core/schemas/rule-blocks";
import { parseCustomTableFields, parseSpellClasses, parseSpellLevel, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

/** `null` pour une reference d'entite — un sort connu n'en a jamais, mais le type de `known[].ref` reste l'union `BlockReference`. */
function ruleKeyOf(ref: SpellcastingBlockData["known"][number]["ref"]): string | null {
  return ref.kind === "rule" ? ref.key : null;
}

interface ClassSpellBudget {
  classKey: string;
  className: string;
  ability: string;
  cantripsAllowed: number;
  spellsAllowed: number;
  maxSpellLevel: number;
}

/**
 * Budget de sorts d'une classe a un niveau donne, lu directement dans son
 * `class_progression` (colonnes `spellcasting_cantrips_known`/
 * `spellcasting_prepared_spells`/`spellcasting_spells_known`/
 * `spellcasting_spell_slots_level_N` — noms exacts poses par
 * `scripts/ingest-srd.ts`, verifies contre le Magicien 2024). `null` si la
 * classe n'a pas de progression d'incantation a ce niveau (classe non
 * incantatrice, ou incantation qui commence plus tard).
 */
function computeBudget(classKey: string, className: string, level: number, blocks: RuleEntryBlockData[] | undefined): ClassSpellBudget | null {
  const progression = findBlock<ClassProgressionBlockData>(blocks, "class_progression");
  const spellInfo = findBlock<SpellcastingProgressionBlockData>(blocks, "spellcasting_progression");
  if (!progression || !spellInfo) return null;
  const row = progression.rows.find((r) => r.level === level);
  if (!row) return null;

  const cantripsAllowed = typeof row.spellcasting_cantrips_known === "number" ? row.spellcasting_cantrips_known : 0;
  const spellsAllowed =
    typeof row.spellcasting_prepared_spells === "number"
      ? row.spellcasting_prepared_spells
      : typeof row.spellcasting_spells_known === "number"
        ? row.spellcasting_spells_known
        : 0;
  if (cantripsAllowed === 0 && spellsAllowed === 0) return null;

  let maxSpellLevel = 0;
  for (let n = 1; n <= 9; n++) {
    const value = row[`spellcasting_spell_slots_level_${n}`];
    if (typeof value === "number" && value > 0) maxSpellLevel = n;
  }

  return { classKey, className, ability: spellInfo.ability, cantripsAllowed, spellsAllowed, maxSpellLevel };
}

/**
 * Encadre depliable, meme langage visuel que `ItemCard` (InventoryPanel.tsx)
 * sans en reutiliser le composant — celui-ci porte poids/cout/equipement,
 * des notions qu'un sort n'a pas (retour utilisateur, V2-G1 : "un peu à la
 * manière des objets dans inventaire"). Selection (bouton principal) et
 * depliage de la description sont deux interactions separees, comme sur
 * `ItemCard` : cliquer le nom choisit/deselectionne le sort, la fleche ne
 * fait que montrer/cacher son texte.
 */
function SpellCard({
  worldSlug,
  entry,
  level,
  isChosen,
  canPick,
  blocks,
  onToggle,
}: {
  worldSlug: string;
  entry: { key: string; name: string };
  level: number | null;
  isChosen: boolean;
  canPick: boolean;
  blocks: RuleEntryBlockData[] | undefined;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptionBlocks = blocks?.filter((b) => b.blockType === "description") ?? [];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-md border transition-colors ${
        isChosen ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised"
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          disabled={!canPick}
          onClick={onToggle}
          className={`min-w-0 flex-1 truncate text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
            isChosen ? "text-accent" : "text-ink"
          }`}
        >
          {entry.name}
        </button>
        {level !== null && <span className="mech shrink-0 text-[10px] text-ink-muted">{level === 0 ? "Mineur" : `Niv. ${level}`}</span>}
        {descriptionBlocks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Replier" : "Déplier"}
            aria-label={expanded ? "Replier" : "Déplier"}
            className="shrink-0 rounded-full px-1.5 text-xs text-ink-muted transition-colors hover:bg-panel hover:text-accent"
          >
            {expanded ? "▴" : "▾"}
          </button>
        )}
      </div>
      {expanded && descriptionBlocks.length > 0 && (
        <div className="border-t border-edge/40 px-2.5 py-2 text-xs text-ink-muted">
          {descriptionBlocks.map((b, i) => (
            <div key={i}>{renderBlockData("description", b.data, worldSlug)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function spellClassesAndLevel(blocks: RuleEntryBlockData[] | undefined): { classes: string[]; level: number | null } {
  const table = blocks?.find((b) => b.blockType === "custom_table");
  if (!table) return { classes: [], level: null };
  const fields = parseCustomTableFields((table.data as CustomTableBlockData).rows as unknown as CustomTableRow[]);
  return { classes: parseSpellClasses(fields), level: parseSpellLevel(fields) };
}

/**
 * Sorts connus/prepares a la creation (point 7 du retour utilisateur) —
 * hors perimetre de specs/wiki-liens-et-personnages.md §B8, ajoute en plus
 * des sept etapes. Un budget par classe incantatrice du personnage (cantrips
 * + sorts, plafonnes par le niveau max d'emplacement disponible), sorts
 * filtres par la meme liste de classes que le SRD (`Spells.classes`).
 * Ecrit directement dans le bloc `spellcasting` (separe de `character`),
 * cree a la validation si au moins un sort a ete choisi.
 */
export default function SpellSelectionStep({
  worldSlug,
  character,
  spellcasting,
  onUpdateSpellcasting,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  spellcasting: SpellcastingBlockData;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const spellEntries = entries.filter((e) => e.entryType === "spell");
  const classKeys = character.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => (c.class as { kind: "rule"; key: string }).key);

  const neededKeys = [...new Set([...classKeys, ...spellEntries.map((e) => e.key)])];
  const blocksByKey = useRuleEntryBlocks(worldSlug, neededKeys);

  const budgets = character.classes
    .filter((c) => c.class.kind === "rule" && c.class.key)
    .map((c) => {
      const key = (c.class as { kind: "rule"; key: string }).key;
      const name = entries.find((e) => e.key === key)?.name ?? key;
      return computeBudget(key, name, c.level, blocksByKey[key]);
    })
    .filter((b): b is ClassSpellBudget => b !== null);

  function toggleSpell(budget: ClassSpellBudget, spellKey: string, kind: "cantrip" | "spell") {
    const isKnown = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === spellKey);
    if (isKnown) {
      onUpdateSpellcasting({
        ...spellcasting,
        known: spellcasting.known.filter((k) => !(k.ref.kind === "rule" && k.ref.key === spellKey)),
        prepared: spellcasting.prepared.filter((k) => k !== spellKey),
      });
      return;
    }

    const pool = spellEntries.filter((e) => {
      const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
      if (!classes.includes(budget.classKey)) return false;
      return kind === "cantrip" ? level === 0 : level !== null && level >= 1 && level <= budget.maxSpellLevel;
    });
    const cap = kind === "cantrip" ? budget.cantripsAllowed : budget.spellsAllowed;
    const selectedInPool = spellcasting.known.filter((k) => pool.some((p) => p.key === ruleKeyOf(k.ref))).length;
    if (selectedInPool >= cap) return;

    const sources = budgets.map((b) => ({ class: b.classKey, ability: b.ability as SpellcastingBlockData["sources"][number]["ability"] }));
    onUpdateSpellcasting({
      ...spellcasting,
      sources,
      known: [...spellcasting.known, { ref: { kind: "rule", key: spellKey }, origin: "class" }],
      prepared: [...spellcasting.prepared, spellKey],
    });
  }

  if (budgets.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune des classes choisies n&apos;incante à ce niveau.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {budgets.map((budget) => {
        const cantripPool = spellEntries.filter((e) => {
          const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
          return classes.includes(budget.classKey) && level === 0;
        });
        const spellPool = spellEntries.filter((e) => {
          const { classes, level } = spellClassesAndLevel(blocksByKey[e.key]);
          return classes.includes(budget.classKey) && level !== null && level >= 1 && level <= budget.maxSpellLevel;
        });
        const knownCantrips = spellcasting.known.filter((k) => cantripPool.some((p) => p.key === ruleKeyOf(k.ref))).length;
        const knownSpells = spellcasting.known.filter((k) => spellPool.some((p) => p.key === ruleKeyOf(k.ref))).length;

        return (
          <div key={budget.classKey} className="flex flex-col gap-3 rounded-md border border-edge/60 p-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{budget.className}</span>

            {budget.cantripsAllowed > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-ink-muted">
                  Sorts mineurs : {knownCantrips}/{budget.cantripsAllowed} choisis
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {cantripPool.map((e) => {
                    const isChosen = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === e.key);
                    const canPick = isChosen || knownCantrips < budget.cantripsAllowed;
                    return (
                      <SpellCard
                        key={e.key}
                        worldSlug={worldSlug}
                        entry={e}
                        level={0}
                        isChosen={isChosen}
                        canPick={canPick}
                        blocks={blocksByKey[e.key]}
                        onToggle={() => toggleSpell(budget, e.key, "cantrip")}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {budget.spellsAllowed > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-ink-muted">
                  Sorts : {knownSpells}/{budget.spellsAllowed} choisis (niveau max {budget.maxSpellLevel})
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {spellPool.map((e) => {
                    const isChosen = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === e.key);
                    const canPick = isChosen || knownSpells < budget.spellsAllowed;
                    const { level } = spellClassesAndLevel(blocksByKey[e.key]);
                    return (
                      <SpellCard
                        key={e.key}
                        worldSlug={worldSlug}
                        entry={e}
                        level={level}
                        isChosen={isChosen}
                        canPick={canPick}
                        blocks={blocksByKey[e.key]}
                        onToggle={() => toggleSpell(budget, e.key, "spell")}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
