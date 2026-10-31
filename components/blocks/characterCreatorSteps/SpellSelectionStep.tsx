"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { AbilityScores } from "@/src/core/schemas/blocks/abilities";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ClassProgressionBlockData, CustomTableBlockData, SpellcastingProgressionBlockData } from "@/src/core/schemas/rule-blocks";
import type { Ability } from "@/src/core/rules/sheet";
import { parseCustomTableFields, parseSpellClasses, parseSpellLevel, type CustomTableRow } from "@/src/core/rules/srdMapping";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";
import SelecteurSorts, { type CandidatSort } from "../characterCreator/SelecteurSorts";
import FicheSort from "../characterCreator/FicheSort";

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

const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

function isAbility(value: string): value is Ability {
  return ABILITY_KEYS.has(value);
}

/**
 * Budget de sorts d'une classe a un niveau donne, lu directement dans son
 * `class_progression` (colonnes `spellcasting_cantrips_known`/
 * `spellcasting_prepared_spells`/`spellcasting_spells_known`/
 * `spellcasting_spell_slots_level_N` — noms exacts poses par
 * `scripts/ingest-srd.ts`, verifies contre le Magicien 2024). `null` si la
 * classe n'a pas de progression d'incantation a ce niveau (classe non
 * incantatrice, ou incantation qui commence plus tard).
 *
 * Bug reel corrige ici (retour utilisateur, V2-G1) : ni
 * `spellcasting_prepared_spells` ni `spellcasting_spells_known` n'existent
 * pour un lanceur "preparant" (Magicien, Clerc, Druide...) — le SRD ne
 * tabule jamais ce nombre par niveau, il depend du modificateur de
 * caracteristique du personnage, pas seulement de son niveau de classe.
 * Sans repli, l'etape Sorts n'affichait alors QUE les sorts mineurs pour
 * ces classes, jamais les sorts de niveau 1+. Repli : modificateur +
 * niveau de classe, minimum 1 — formule officielle (PHB/SRD), la meme pour
 * les cinq classes concernees.
 */
function computeBudget(
  classKey: string,
  className: string,
  level: number,
  abilityScores: AbilityScores,
  blocks: RuleEntryBlockData[] | undefined
): ClassSpellBudget | null {
  const progression = findBlock<ClassProgressionBlockData>(blocks, "class_progression");
  const spellInfo = findBlock<SpellcastingProgressionBlockData>(blocks, "spellcasting_progression");
  if (!progression || !spellInfo) return null;
  const row = progression.rows.find((r) => r.level === level);
  if (!row) return null;

  const cantripsAllowed = typeof row.spellcasting_cantrips_known === "number" ? row.spellcasting_cantrips_known : 0;

  let maxSpellLevel = 0;
  for (let n = 1; n <= 9; n++) {
    const value = row[`spellcasting_spell_slots_level_${n}`];
    if (typeof value === "number" && value > 0) maxSpellLevel = n;
  }

  let spellsAllowed: number;
  if (typeof row.spellcasting_prepared_spells === "number") {
    spellsAllowed = row.spellcasting_prepared_spells;
  } else if (typeof row.spellcasting_spells_known === "number") {
    spellsAllowed = row.spellcasting_spells_known;
  } else if (maxSpellLevel > 0 && isAbility(spellInfo.ability)) {
    const score = abilityScores[spellInfo.ability];
    spellsAllowed = Math.max(1, Math.floor((score - 10) / 2) + level);
  } else {
    spellsAllowed = 0;
  }

  if (cantripsAllowed === 0 && spellsAllowed === 0) return null;

  return { classKey, className, ability: spellInfo.ability, cantripsAllowed, spellsAllowed, maxSpellLevel };
}

/** Exportée pour le chemin de création (V3.1-49) : un choix de sort s'y filtre par liste et par niveau. */
export function spellClassesAndLevel(blocks: RuleEntryBlockData[] | undefined): { classes: string[]; level: number | null } {
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
  const t = useTranslations("creation.sorts");
  const [touche, setTouche] = useState<string | null>(null);
  const entries = useWorldRuleEntries(worldSlug);
  const spellEntries = entries.filter((e) => e.entryType === "spell");
  const classKeys = character.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => (c.class as { kind: "rule"; key: string }).key);

  // Deux appels separes plutot qu'un seul lot fusionne (retour utilisateur :
  // "l'onglet sorts prend vraiment longtemps a charger") : le lot des sorts
  // (`spellEntries`) est EXACTEMENT le meme ensemble de cles que le
  // prechargement lance des l'etape 1 par `CharacterCreatorWizard`
  // (`useRuleEntryBlocks` met en cache par le JSON trie des cles demandees)
  // — y ajouter les cles de classe changerait ce JSON et manquerait le
  // cache prechauffe, ce qui annulait l'essentiel du gain mesure en test.
  const spellBlocksByKey = useRuleEntryBlocks(
    worldSlug,
    spellEntries.map((e) => e.key)
  );
  const classBlocksByKey = useRuleEntryBlocks(worldSlug, classKeys);
  const blocksByKey = { ...spellBlocksByKey, ...classBlocksByKey };

  const budgets = character.classes
    .filter((c) => c.class.kind === "rule" && c.class.key)
    .map((c) => {
      const key = (c.class as { kind: "rule"; key: string }).key;
      const name = entries.find((e) => e.key === key)?.name ?? key;
      return computeBudget(key, name, c.level, character.abilities.base, blocksByKey[key]);
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
    return <p className="text-sm text-ink-muted">{t("aucuneClasse")}</p>;
  }

  const candidats = (cles: readonly { key: string; name: string }[], niveauDe: (key: string) => number | null): CandidatSort[] =>
    cles
      .map((e) => ({ cle: e.key, nom: e.name, niveau: niveauDe(e.key) }))
      .sort((a, b) => (a.niveau ?? 0) - (b.niveau ?? 0) || a.nom.localeCompare(b.nom));

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
        const knownCantrips = spellcasting.known.filter((k) => cantripPool.some((p) => p.key === ruleKeyOf(k.ref))).map((k) => ruleKeyOf(k.ref) ?? "");
        const knownSpells = spellcasting.known.filter((k) => spellPool.some((p) => p.key === ruleKeyOf(k.ref))).map((k) => ruleKeyOf(k.ref) ?? "");

        return (
          <div key={budget.classKey} className="flex flex-col gap-4 rounded-md border border-edge/60 p-3">
            <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{budget.className}</span>

            {budget.cantripsAllowed > 0 && (
              <SelecteurSorts
                worldSlug={worldSlug}
                titre={t("sortsMineurs")}
                candidats={candidats(cantripPool, () => 0)}
                blocs={blocksByKey}
                choisis={knownCantrips}
                max={budget.cantripsAllowed}
                onBasculer={(key) => toggleSpell(budget, key, "cantrip")}
                touche={touche}
                onToucher={setTouche}
              />
            )}

            {/* Le budget reste un seul total combiné (le SRD ne compte jamais
                les sorts connus par niveau, cf. `computeBudget`) : un sélecteur
                pour tous les niveaux, filtrable par niveau. */}
            {budget.spellsAllowed > 0 && (
              <SelecteurSorts
                worldSlug={worldSlug}
                titre={t("sortsPrepares", { classe: budget.className, max: budget.maxSpellLevel })}
                candidats={candidats(spellPool, (key) => spellClassesAndLevel(blocksByKey[key]).level)}
                blocs={blocksByKey}
                choisis={knownSpells}
                max={budget.spellsAllowed}
                onBasculer={(key) => toggleSpell(budget, key, "spell")}
                touche={touche}
                onToucher={setTouche}
              />
            )}
          </div>
        );
      })}
      <FicheSort worldSlug={worldSlug} cle={touche} nom={spellEntries.find((e) => e.key === touche)?.name ?? touche ?? ""} blocs={touche ? blocksByKey[touche] : undefined} />
    </div>
  );
}
