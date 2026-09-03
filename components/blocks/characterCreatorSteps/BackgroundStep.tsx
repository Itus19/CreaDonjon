"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BackgroundBlockData, BackgroundEquipmentOption, BlockType } from "@/src/core/schemas/rule-blocks";
import type { Ability, Skill } from "@/src/core/rules/sheet";
import { parseBackgroundAbilityBonusChoice, type BackgroundAbilityBonusChoice } from "@/src/core/rules/backgroundAbilityBonus";
import { CLASS_PROFICIENCY_LABELS_FR, SKILL_LABELS_FR } from "@/src/i18n/fr";
import { renderBlockData, type EquipmentCardInteraction } from "@/components/rules/blockContentRenderer";
import Stepper from "@/components/shared/Stepper";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

export interface BackgroundEquipmentChoice {
  backgroundKey: string;
  optionLabel: string;
  appliedGold: { value: number; unit: string } | null;
}

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

function modifierOf(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatMod(score: number): string {
  const mod = modifierOf(score);
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

function withoutAbilityBonusChoice(choices: CharacterBlockData["choices"]): CharacterBlockData["choices"] {
  if (!(ABILITY_BONUS_CHOICE_KEY in choices)) return choices;
  const rest = { ...choices };
  delete rest[ABILITY_BONUS_CHOICE_KEY];
  return rest;
}

interface BackgroundCardInfo {
  featName: string | null;
  statsLine: string | null;
  toolLine: string | null;
  skillsLine: string | null;
}

/**
 * Don lie, valeurs de caracteristique, maitrise d'outil et maitrises de
 * competence d'un historique, pour les afficher directement sur son bouton
 * (retour utilisateur, V2-G1 — meme demande que pour les boutons d'espece,
 * `SpeciesStep.tsx`). `feat_name` vient de la resolution serveur
 * (`listRuleEntryBlocksByKeys`, ResolvedBackgroundBlockData) deja appliquee
 * a ce bloc — jamais recalculee ici, seulement lue.
 */
function backgroundCardInfo(blocks: RuleEntryBlockData[] | undefined): BackgroundCardInfo | null {
  const data = findBlock<BackgroundBlockData & { feat_name?: string }>(blocks, "background");
  if (!data) return null;
  return {
    featName: data.feat_name ?? null,
    statsLine: data.ability_scores.map((a) => ABILITY_LABELS[a] ?? a.toUpperCase()).join(", "),
    toolLine: data.tool_proficiency ? (CLASS_PROFICIENCY_LABELS_FR[data.tool_proficiency] ?? data.tool_proficiency) : null,
    skillsLine: data.skill_proficiencies.map((s) => SKILL_LABELS_FR[s as Skill] ?? s).join(", "),
  };
}

const TAG_PREFIX = "background:";
const ABILITY_BONUS_CHOICE_KEY = "background.ability_bonus";
const ABILITY_BONUS_CAP = 20;
/** 3 points a repartir (regle 2024) : soit +2/+1 sur deux caracteristiques, soit +1 sur les trois — `isValidBackgroundAbilityBonusChoice` (backgroundAbilityBonus.ts) n'accepte que ces deux formes, toutes deux exactement 3 points au total. */
const ABILITY_BONUS_BUDGET = 3;
/** Un maximum de +2 sur une seule caracteristique (regle 2024) — jamais 3, meme si le budget le permettrait arithmetiquement. */
const ABILITY_BONUS_MAX_PER_ABILITY = 2;
const EMPTY_ABILITY_BONUS_CHOICE: BackgroundAbilityBonusChoice = { kind: "background_ability_bonus", increases: {} };

/**
 * Etape 4 (specs/wiki-liens-et-personnages.md §B8) : boutons pour
 * l'historique (meme motif que `SpeciesStep`/`LevelClassesStep`), puis, si sa
 * fiche porte un `equipment_options` (2024 : "choisissez A ou B", jamais
 * juste du texte fige — cf. `zBackgroundBlockData`), le vrai choix
 * d'equipement de depart contre or, absent jusqu'ici (retour utilisateur :
 * l'assistant ignorait completement ce champ pourtant deja modelise).
 *
 * Les objets ajoutes par un choix sont marques (`notes` = "background:<cle
 * historique>:<option>") pour pouvoir les retirer proprement si l'utilisateur
 * change d'avis — jamais une deuxieme fois la meme option, jamais un residu
 * de l'ancienne quand on en choisit une autre. L'or ajoute est retire a
 * l'identique avant d'appliquer le nouveau choix.
 *
 * Selection par clic direct sur l'encadre (retour utilisateur, V2-G1 —
 * remplace les boutons "Choisir A/B" separes) : `equipmentInteraction`
 * rend l'encadre de `Background()` (blockContentRenderer.tsx) cliquable,
 * jamais sur une fiche de regle en lecture seule.
 *
 * Bonus de caracteristique de l'historique (V2-G7, regle 2024) : section a
 * part, sous le contenu existant — jamais sur l'etape Caracteristiques, qui
 * reste independante de l'historique choisi (les trois methodes
 * d'attribution existantes ne lisent aucun historique). Repartition par
 * budget de points (retour utilisateur) : `character.abilities.base` suffit
 * comme reference, `sheet` n'est plus necessaire ici.
 */
export default function BackgroundStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  choice,
  onChooseOption,
  backgroundAbilityScores,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  choice: BackgroundEquipmentChoice | null;
  onChooseOption: (choice: BackgroundEquipmentChoice | null) => void;
  backgroundAbilityScores: Ability[] | null;
}) {
  const entries = useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "background");
  const blocksByKey = useRuleEntryBlocks(
    worldSlug,
    entries.map((e) => e.key)
  );

  const currentKey = character.background?.kind === "rule" ? character.background.key : "";
  const currentBlocks = blocksByKey[currentKey];
  const backgroundData = findBlock<BackgroundBlockData>(currentBlocks, "background");

  // Membre choisi pour un item "au choix" (ex. Symbole sacre -> Amulette),
  // retour utilisateur V2-G1 — indexe par `<option.label>:<index d'item>`,
  // remis a zero au changement d'historique pour ne jamais heriter une
  // selection d'un autre historique reutilisant les memes labels "A"/"B".
  // Vide (cle absente) tant que le joueur n'a pas explicitement choisi
  // (retour utilisateur suite : jamais de premier membre presuppose) — l'item
  // reste alors un objet generique sans reference, comme avant cette
  // fonctionnalite.
  const [categorySelections, setCategorySelections] = useState<Record<string, string>>({});

  function select(key: string) {
    const switching = key !== currentKey;
    const nextChoices = switching ? withoutAbilityBonusChoice(character.choices) : character.choices;
    patchCharacter({ background: { kind: "rule", key }, choices: nextChoices });
    if (switching) {
      onChooseOption(null);
      setCategorySelections({});
    }
  }

  function applyOption(option: BackgroundEquipmentOption, overrides?: Record<string, string>) {
    const selections = overrides ?? categorySelections;
    let items: InventoryItem[] = inventory.items.filter((it) => !it.notes?.startsWith(TAG_PREFIX));
    const currency = { ...inventory.currency };

    if (choice?.appliedGold) {
      const unit = choice.appliedGold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = Math.max(0, currency[unit] - choice.appliedGold.value);
    }

    const tag = `${TAG_PREFIX}${currentKey}:${option.label}`;
    const newItems: InventoryItem[] = option.items.map((it, i) => {
      const categoryKey = it.category_options?.length ? selections[`${option.label}:${i}`] : undefined;
      const ref =
        it.ref?.kind === "rule" ? { kind: "rule" as const, key: it.ref.key } : categoryKey ? { kind: "rule" as const, key: categoryKey } : undefined;
      return {
        id: `bg-${currentKey}-${option.label}-${i}`,
        qty: it.quantity,
        notes: tag,
        ...(ref ? { ref } : { label: it.label }),
      };
    });
    items = [...items, ...newItems];

    if (option.gold) {
      const unit = option.gold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = (currency[unit] ?? 0) + option.gold.value;
    }

    onUpdateInventory({ ...inventory, items, currency });
    onChooseOption({ backgroundKey: currentKey, optionLabel: option.label, appliedGold: option.gold ?? null });
  }

  // Clic direct sur l'encadre de choix (retour utilisateur, V2-G1 — remplace
  // les boutons "Choisir A/B" separes) : l'encadre vient de la fiche
  // generique (`Background()`, blockContentRenderer.tsx), cette interaction
  // le rend cliquable uniquement ici, jamais sur une fiche de regle en
  // lecture seule. `categoryChoice` (meme retour utilisateur, suite) laisse
  // choisir le membre reel d'une categorie "au choix" (ex. Symbole sacre) —
  // reapplique immediatement si l'option est deja la selection active, pour
  // que l'inventaire reflete toujours le dernier choix sans reclic sur
  // l'encadre.
  const equipmentInteraction: EquipmentCardInteraction | undefined = backgroundData
    ? {
        isChosen: (optionLabel) => choice?.backgroundKey === currentKey && choice.optionLabel === optionLabel,
        onSelect: (optionLabel) => {
          const option = backgroundData.equipment_options.find((o) => o.label === optionLabel);
          if (option) applyOption(option);
        },
        categoryChoice: {
          selectedKey: (optionLabel, itemIndex) => categorySelections[`${optionLabel}:${itemIndex}`] ?? "",
          onSelectKey: (optionLabel, itemIndex, key) => {
            const stateKey = `${optionLabel}:${itemIndex}`;
            const next = { ...categorySelections, [stateKey]: key };
            setCategorySelections(next);
            if (choice?.backgroundKey === currentKey && choice.optionLabel === optionLabel) {
              const option = backgroundData.equipment_options.find((o) => o.label === optionLabel);
              if (option) applyOption(option, next);
            }
          },
        },
      }
    : undefined;

  // Bonus de caracteristique de l'historique (V2-G7, regle 2024) — retour
  // utilisateur : repartition libre par +/- (meme motif que l'achat de
  // points, `AbilityScoreStep.tsx`) plutot qu'un choix de "mode" prealable.
  // Un budget fixe de 3 points, plafonne a 2 par caracteristique, ne permet
  // d'atteindre QUE les deux formes officielles une fois entierement
  // depense (2+1+0 ou 1+1+1) — `isValidBackgroundAbilityBonusChoice` n'en
  // accepte d'ailleurs aucune autre, jamais besoin de choisir un mode a part.
  const abilityChoice = parseBackgroundAbilityBonusChoice(character.choices[ABILITY_BONUS_CHOICE_KEY]) ?? EMPTY_ABILITY_BONUS_CHOICE;
  const abilitySpent = Object.values(abilityChoice.increases).reduce((sum: number, v) => sum + (v ?? 0), 0);
  const abilityRemaining = ABILITY_BONUS_BUDGET - abilitySpent;

  function setAbilityChoice(next: BackgroundAbilityBonusChoice) {
    patchCharacter({ choices: { ...character.choices, [ABILITY_BONUS_CHOICE_KEY]: next } });
  }

  function incrementAbility(ability: Ability) {
    const current = abilityChoice.increases[ability] ?? 0;
    if (current >= ABILITY_BONUS_MAX_PER_ABILITY || abilityRemaining <= 0) return;
    if (character.abilities.base[ability] + current + 1 > ABILITY_BONUS_CAP) return;
    setAbilityChoice({ kind: "background_ability_bonus", increases: { ...abilityChoice.increases, [ability]: current + 1 } });
  }

  function decrementAbility(ability: Ability) {
    const current = abilityChoice.increases[ability] ?? 0;
    if (current <= 0) return;
    const increases = { ...abilityChoice.increases };
    if (current === 1) delete increases[ability];
    else increases[ability] = current - 1;
    setAbilityChoice({ kind: "background_ability_bonus", increases });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {entries.map((e) => {
          const info = backgroundCardInfo(blocksByKey[e.key]);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => select(e.key)}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                e.key === currentKey ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
              }`}
            >
              <span className="text-sm font-semibold text-ink">{e.name}</span>
              {info?.featName && <span className="text-[10px] text-ink-muted">Don : {info.featName}</span>}
              {info?.statsLine && <span className="text-[10px] text-ink-muted">{info.statsLine}</span>}
              {info?.toolLine && <span className="text-[10px] text-ink-muted">{info.toolLine}</span>}
              {info?.skillsLine && <span className="text-[10px] text-ink-muted">{info.skillsLine}</span>}
            </button>
          );
        })}
      </div>

      {currentKey && currentBlocks && currentBlocks.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
          {currentBlocks
            .filter((b) => b.blockType === "description" || b.blockType === "background")
            .map((b, i) => (
              <div key={i}>
                {renderBlockData(
                  b.blockType as BlockType,
                  b.data,
                  worldSlug,
                  [],
                  b.blockType === "background" ? equipmentInteraction : undefined
                )}
              </div>
            ))}
        </div>
      )}

      {currentKey && backgroundAbilityScores && backgroundAbilityScores.length === 3 && (
        <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Bonus de caractéristique de l&rsquo;historique</p>
            <span className={`text-xs ${abilityRemaining > 0 ? "text-ink-muted" : "text-accent"}`}>
              {abilityRemaining} point{abilityRemaining !== 1 ? "s" : ""} à répartir
            </span>
          </div>

          {/* Meme encadre/Stepper que les caracteristiques de base
              (`AbilityScoreStep.tsx`, achat de points) — retour utilisateur :
              "reprendre l'esthetique des stats normales", boutons +/-. Trois
              encadres au plus (`backgroundAbilityScores.length === 3` ci-dessus),
              un par caracteristique CONCERNEE par cet historique. */}
          <div className="grid grid-cols-3 gap-2">
            {backgroundAbilityScores.map((ability) => {
              const increase = abilityChoice.increases[ability] ?? 0;
              const base = character.abilities.base[ability];
              const nextScore = base + increase;
              return (
                <div key={ability} className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability] ?? ability.toUpperCase()}</span>
                  <Stepper
                    onIncrement={() => incrementAbility(ability)}
                    onDecrement={() => decrementAbility(ability)}
                    incrementDisabled={increase >= ABILITY_BONUS_MAX_PER_ABILITY || abilityRemaining <= 0 || base + increase + 1 > ABILITY_BONUS_CAP}
                    decrementDisabled={increase <= 0}
                    incrementLabel={`Augmenter ${ABILITY_LABELS[ability]}`}
                    decrementLabel={`Diminuer ${ABILITY_LABELS[ability]}`}
                    className="w-14"
                  >
                    <span className="text-xl font-bold text-ink">{nextScore}</span>
                  </Stepper>
                  <span className="text-xs text-ink-muted">{formatMod(nextScore)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
