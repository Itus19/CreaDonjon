"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockType, ClassBasicsBlockData, SubclassSlotBlockData } from "@/src/core/schemas/rule-blocks";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";

const ABILITY_LABELS: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

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
export default function LevelClassesStep({
  worldSlug,
  character,
  patchCharacter,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
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

  function updateSlot(index: number, patch: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }

  function removeSlot(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
  }

  function addSlot() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

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
                      onClick={() => updateSlot(index, { class: { kind: "rule", key: e.key }, subclass: null })}
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
