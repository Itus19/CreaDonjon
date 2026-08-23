"use client";

import { useEffect } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type {
  BackgroundEquipmentOption,
  BlockType,
  ClassBasicsBlockData,
  ClassEquipmentBlockData,
  SubclassSlotBlockData,
} from "@/src/core/schemas/rule-blocks";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

export interface ClassEquipmentChoiceState {
  optionLabel: string;
  appliedGold: { value: number; unit: string } | null;
}

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

function classCardSubtitle(basics: ClassBasicsBlockData | null): string | null {
  if (!basics) return null;
  const saves = basics.saving_throw_proficiencies.map((a) => ABILITY_LABELS[a] ?? a.toUpperCase()).join("/");
  return `d${basics.hit_die}${saves ? ` · Sauv. ${saves}` : ""}`;
}

/**
 * Etape 2 (specs/wiki-liens-et-personnages.md §B8, etendue sur demande
 * explicite au multiclassage complet) : un emplacement par classe, niveau
 * editable, sous-classe gatee par `subclass_slot.chosen_at_level` de CETTE
 * classe (une classe qui choisit sa sous-classe au niveau 3 ne la propose
 * pas avant). Boutons plutot qu'un menu deroulant, bases de classe visibles
 * directement dessus (hors du role de `RuleSelect` — meme motif que le
 * D&D Beyond de reference fourni par l'utilisateur, adapte a notre DA) :
 * `class_basics`/`description` viennent de `useRuleEntryBlocks`, jamais du
 * resume fige `ai_digest` des chips — a jour si le MJ edite la fiche.
 */
const EQUIPMENT_TAG_PREFIX = "class-equipment:";

export default function LevelClassesStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  equipmentChoices,
  onChooseEquipmentChoices,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  equipmentChoices: (ClassEquipmentChoiceState | null)[];
  onChooseEquipmentChoices: (choices: (ClassEquipmentChoiceState | null)[]) => void;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const classEntries = entries.filter((e) => e.entryType === "class");
  const subclassEntries = entries.filter((e) => e.entryType === "subclass");

  const selectedSubclassKeys = character.classes
    .map((c) => (c.subclass?.kind === "rule" ? c.subclass.key : null))
    .filter((k): k is string => Boolean(k));
  const neededKeys = [...new Set([...classEntries.map((e) => e.key), ...selectedSubclassKeys])];
  const blocksByKey = useRuleEntryBlocks(worldSlug, neededKeys);

  const totalLevel = character.classes.reduce((sum, c) => sum + c.level, 0);

  // Equipement de depart : seule la PREMIERE classe en accorde a la
  // creation (retour utilisateur, point 9 — meme regle que le jeu reel : le
  // multiclassage ne redonne jamais d'equipement de depart, seule la classe
  // initiale en octroie).
  const firstClassKey = character.classes[0]?.class.kind === "rule" ? character.classes[0].class.key : "";
  const firstClassEquipment = findBlock<ClassEquipmentBlockData>(blocksByKey[firstClassKey], "class_equipment");

  function updateSlot(index: number, patch: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }

  function removeSlot(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
  }

  function addSlot() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

  function selectClass(index: number, key: string, previousKey: string) {
    updateSlot(index, { class: { kind: "rule", key }, subclass: null });
    if (index !== 0 || key === previousKey) return;

    // Changer de premiere classe retire les choix d'equipement (et leur or)
    // de l'ancienne — les objets fixes se reconcilient d'eux-memes plus bas
    // des que la fiche de la nouvelle classe est chargee.
    const items = inventory.items.filter((it) => !it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}choice:`));
    const currency = { ...inventory.currency };
    for (const choice of equipmentChoices) {
      if (choice?.appliedGold) {
        const unit = choice.appliedGold.unit as keyof typeof currency;
        if (unit in currency) currency[unit] = Math.max(0, currency[unit] - choice.appliedGold.value);
      }
    }
    onUpdateInventory({ ...inventory, items, currency });
    onChooseEquipmentChoices([]);
  }

  function chooseEquipmentOption(choiceIndex: number, option: BackgroundEquipmentOption) {
    const prior = equipmentChoices[choiceIndex] ?? null;
    let items = inventory.items.filter((it) => it.notes !== `${EQUIPMENT_TAG_PREFIX}choice:${choiceIndex}`);
    const currency = { ...inventory.currency };
    if (prior?.appliedGold) {
      const unit = prior.appliedGold.unit as keyof typeof currency;
      if (unit in currency) currency[unit] = Math.max(0, currency[unit] - prior.appliedGold.value);
    }

    const tag = `${EQUIPMENT_TAG_PREFIX}choice:${choiceIndex}`;
    const newItems: InventoryItem[] = option.items.map((it, i) => ({
      id: `class-choice-${firstClassKey}-${choiceIndex}-${i}`,
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
    const nextChoices = [...equipmentChoices];
    nextChoices[choiceIndex] = { optionLabel: option.label, appliedGold: option.gold ?? null };
    onChooseEquipmentChoices(nextChoices);
  }

  // Objets TOUJOURS accordes par la premiere classe (`class_equipment.fixed`,
  // ex. le Grimoire du Magicien) — reconcilies automatiquement, sans bouton :
  // contrairement a un choix, il n'y a rien a decider. Un `useEffect` plutot
  // qu'un appel direct dans `selectClass` : la fiche de la classe choisie
  // (`blocksByKey`) n'est pas forcement encore chargee au moment du clic,
  // cet effet se redeclenche de lui-meme des qu'elle arrive.
  useEffect(() => {
    const fixedTag = `${EQUIPMENT_TAG_PREFIX}fixed:${firstClassKey}`;
    const stale = inventory.items.filter((it) => it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}fixed:`) && it.notes !== fixedTag);
    const alreadyApplied = inventory.items.some((it) => it.notes === fixedTag);
    const desiredFixed = firstClassEquipment?.fixed ?? [];
    if (stale.length === 0 && (alreadyApplied || desiredFixed.length === 0)) return;

    const items = inventory.items.filter((it) => !it.notes?.startsWith(`${EQUIPMENT_TAG_PREFIX}fixed:`));
    const newItems: InventoryItem[] = alreadyApplied
      ? []
      : desiredFixed.map((it, i) => ({
          id: `class-fixed-${firstClassKey}-${i}`,
          qty: it.quantity,
          notes: fixedTag,
          ...(it.ref?.kind === "rule" ? { ref: { kind: "rule" as const, key: it.ref.key } } : { label: it.label }),
        }));
    onUpdateInventory({ ...inventory, items: [...items, ...newItems] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstClassKey, firstClassEquipment]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">
        Niveau total : <strong>{totalLevel}</strong>
      </p>

      {character.classes.map((slot, index) => {
        const classKey = slot.class.kind === "rule" ? slot.class.key : "";
        const classBlocks = blocksByKey[classKey];
        const subclassSlot = findBlock<SubclassSlotBlockData>(classBlocks, "subclass_slot");
        const showSubclass = subclassSlot !== null && slot.level >= subclassSlot.chosen_at_level;
        const availableSubclasses = subclassEntries.filter((e) => e.parentClassKey === classKey);
        const usedByOtherSlots = new Set(
          character.classes.filter((_, i) => i !== index).map((c) => (c.class.kind === "rule" ? c.class.key : ""))
        );
        const subclassKey = slot.subclass?.kind === "rule" ? slot.subclass.key : "";
        const subclassBlocks = blocksByKey[subclassKey];

        return (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Classe {index + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-ink-muted">
                  Niveau
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={slot.level}
                    onChange={(e) => updateSlot(index, { level: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                    className="w-14 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-sm text-ink outline-none"
                  />
                </label>
                {character.classes.length > 1 && (
                  <button type="button" onClick={() => removeSlot(index)} className="text-xs text-danger hover:underline">
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {classEntries
                .filter((e) => e.key === classKey || !usedByOtherSlots.has(e.key))
                .map((e) => {
                  const eBasics = findBlock<ClassBasicsBlockData>(blocksByKey[e.key], "class_basics");
                  const subtitle = classCardSubtitle(eBasics);
                  const isSelected = e.key === classKey;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => selectClass(index, e.key, classKey)}
                      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        isSelected ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink">{e.name}</span>
                      {subtitle && <span className="text-[10px] text-ink-muted">{subtitle}</span>}
                    </button>
                  );
                })}
            </div>

            {classKey && classBlocks && classBlocks.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
                {classBlocks
                  .filter((b) => b.blockType === "description" || b.blockType === "class_basics")
                  .map((b, i) => (
                    <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
                  ))}
              </div>
            )}

            {/* Equipement de depart, uniquement pour la premiere classe
                (retour utilisateur, point 9) : fiche complete (objets fixes
                + chaque choix, deja resolus) suivie des boutons de choix,
                meme separation fiche/boutons que l'historique
                (`BackgroundStep`). */}
            {index === 0 && firstClassEquipment && (
              <>
                <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
                  {renderBlockData("class_equipment", firstClassEquipment, worldSlug)}
                </div>
                {firstClassEquipment.choices.map((choice, choiceIndex) => (
                  <div key={choiceIndex} className="flex flex-wrap gap-2">
                    {choice.options.map((option) => {
                      const isChosen = equipmentChoices[choiceIndex]?.optionLabel === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => chooseEquipmentOption(choiceIndex, option)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            isChosen ? "border-accent bg-accent/10 text-accent" : "border-edge/60 bg-panel-raised text-ink hover:bg-panel"
                          }`}
                        >
                          Choisir {option.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}

            {/* Sous-classe sous la fiche de classe (retour utilisateur,
                V2-G1) : choisir une sous-classe AJOUTE sa propre fiche en
                dessous plutot que de remplacer celle de la classe — les deux
                restent visibles a la fois, meme motif que espece/lignee
                (`SpeciesStep`). */}
            {showSubclass && availableSubclasses.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {availableSubclasses.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => updateSlot(index, { subclass: { kind: "rule", key: e.key } })}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      e.key === subclassKey ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            )}

            {subclassKey && subclassBlocks && subclassBlocks.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 text-sm text-ink">
                {subclassBlocks
                  .filter((b) => b.blockType === "description" || b.blockType === "subclass_features")
                  .map((b, i) => (
                    <div key={i}>{renderBlockData(b.blockType as BlockType, b.data, worldSlug)}</div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addSlot}
        className="w-fit rounded-full border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter une classe
      </button>
    </div>
  );
}
