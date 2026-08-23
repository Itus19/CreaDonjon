"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ClassProgressionBlockData, CustomTableBlockData, SpellcastingProgressionBlockData } from "@/src/core/schemas/rule-blocks";
import { parseCustomTableFields, parseSpellClasses, parseSpellLevel, type CustomTableRow } from "@/src/core/rules/srdMapping";
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
                <div className="flex flex-wrap gap-2">
                  {cantripPool.map((e) => {
                    const isChosen = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === e.key);
                    const canPick = isChosen || knownCantrips < budget.cantripsAllowed;
                    return (
                      <button
                        key={e.key}
                        type="button"
                        disabled={!canPick}
                        onClick={() => toggleSpell(budget, e.key, "cantrip")}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                        }`}
                      >
                        {e.name}
                      </button>
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
                <div className="flex flex-wrap gap-2">
                  {spellPool.map((e) => {
                    const isChosen = spellcasting.known.some((k) => k.ref.kind === "rule" && k.ref.key === e.key);
                    const canPick = isChosen || knownSpells < budget.spellsAllowed;
                    const { level } = spellClassesAndLevel(blocksByKey[e.key]);
                    return (
                      <button
                        key={e.key}
                        type="button"
                        disabled={!canPick}
                        onClick={() => toggleSpell(budget, e.key, "spell")}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                        }`}
                      >
                        {e.name} <span className="text-[10px] text-ink-muted">(niv. {level})</span>
                      </button>
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
