"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BackgroundBlockData, BackgroundEquipmentOption, BlockType } from "@/src/core/schemas/rule-blocks";
import type { Skill } from "@/src/core/rules/sheet";
import { CLASS_PROFICIENCY_LABELS_FR, SKILL_LABELS_FR } from "@/src/i18n/fr";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

export interface BackgroundEquipmentChoice {
  backgroundKey: string;
  optionLabel: string;
  appliedGold: { value: number; unit: string } | null;
}

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
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
 */
export default function BackgroundStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  choice,
  onChooseOption,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  choice: BackgroundEquipmentChoice | null;
  onChooseOption: (choice: BackgroundEquipmentChoice | null) => void;
}) {
  const entries = useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "background");
  const blocksByKey = useRuleEntryBlocks(
    worldSlug,
    entries.map((e) => e.key)
  );

  const currentKey = character.background?.kind === "rule" ? character.background.key : "";
  const currentBlocks = blocksByKey[currentKey];
  const backgroundData = findBlock<BackgroundBlockData>(currentBlocks, "background");

  function select(key: string) {
    patchCharacter({ background: { kind: "rule", key } });
    if (key !== currentKey) onChooseOption(null);
  }

  function applyOption(option: BackgroundEquipmentOption) {
    let items: InventoryItem[] = inventory.items.filter((it) => !it.notes?.startsWith(TAG_PREFIX));
    const currency = { ...inventory.currency };

    if (choice?.appliedGold) {
      const unit = choice.appliedGold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = Math.max(0, currency[unit] - choice.appliedGold.value);
    }

    const tag = `${TAG_PREFIX}${currentKey}:${option.label}`;
    const newItems: InventoryItem[] = option.items.map((it, i) => ({
      id: `bg-${currentKey}-${option.label}-${i}`,
      qty: it.quantity,
      notes: tag,
      ...(it.ref?.kind === "rule" ? { ref: { kind: "rule" as const, key: it.ref.key } } : { label: it.label }),
    }));
    items = [...items, ...newItems];

    if (option.gold) {
      const unit = option.gold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = (currency[unit] ?? 0) + option.gold.value;
    }

    onUpdateInventory({ ...inventory, items, currency });
    onChooseOption({ backgroundKey: currentKey, optionLabel: option.label, appliedGold: option.gold ?? null });
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
              <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
            ))}
        </div>
      )}

      {backgroundData && backgroundData.equipment_options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {/* Boutons de choix seuls, sans repeter le detail des objets — deja
              visible juste au-dessus dans la fiche generique (`Background()`,
              blockContentRenderer.tsx), qui montre chaque option en carte avec
              son detail complet. Repeter ce detail ici (retour utilisateur,
              V2-G1 : "hierarchisation confuse") faisait doublon. */}
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Choix de l&apos;équipement</span>
          <div className="flex flex-wrap gap-2">
            {backgroundData.equipment_options.map((option) => {
              const isChosen = choice?.backgroundKey === currentKey && choice.optionLabel === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => applyOption(option)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isChosen ? "border-accent bg-accent/10 text-accent" : "border-edge/60 bg-panel-raised text-ink hover:bg-panel"
                  }`}
                >
                  Choisir {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
