"use client";

import { useMemo } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import {
  characterSheet,
  type Ability,
  type CharacterBuild,
  type EquippedItem,
  type ResolvedFeature,
} from "@/src/core/rules/sheet";
import { armorAcModifier, mapChosenSkillModifiers } from "@/src/core/rules/srdMapping";
import { useResolvedRuleset } from "./useResolvedRuleset";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import RuleChip from "@/components/rules/RuleChip";
import { itemLabel, itemRef } from "./InventoryBlockEditor";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Force",
  dex: "Dexterite",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme",
};

function toggleChoice(current: string[], option: string, max: number): string[] {
  if (current.includes(option)) return current.filter((o) => o !== option);
  if (current.length >= max) return current;
  return [...current, option];
}

/**
 * Panneau d'apercu vivant du personnage (V1-B4, specs/wiki-liens-et-personnages.md
 * §B7-§B8) : recalcule `characterSheet()` a chaque rendu — la fiche se
 * recalcule a chaque modification (critere du ticket), sans debounce sur
 * le calcul lui-meme, seul l'assemblage du ruleset (especes/classes) est
 * mis en cache et refetch uniquement quand ces champs changent. Rendu par
 * `EntityBlocks` (pas par l'editeur du bloc `character` seul) car il a
 * besoin, en plus, du bloc `inventory` — deux blocs distincts de la meme
 * entite.
 */
export default function CharacterSheetPreview({
  worldSlug,
  character,
  inventory,
  onUpdateChoices,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  inventory: InventoryBlockData | undefined;
  onUpdateChoices: (choices: Record<string, unknown>) => void;
}) {
  const speciesKey = character.species?.kind === "rule" ? character.species.key : undefined;
  const backgroundKey = character.background?.kind === "rule" ? character.background.key : undefined;
  const classSelections = useMemo(
    () =>
      character.classes
        .filter((c) => c.class.kind === "rule" && c.class.key)
        .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level })),
    [character.classes]
  );
  const equipmentKeys = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule").map((r) => r.key),
    [inventory]
  );

  const { ruleset, remainingChoices, equipment } = useResolvedRuleset(worldSlug, {
    species: speciesKey,
    background: backgroundKey,
    classes: classSelections,
    equipmentKeys,
  });

  const dexScore = character.abilities.base.dex;
  const dexMod = Math.floor((dexScore - 10) / 2);

  const equippedItems: EquippedItem[] = useMemo(
    () =>
      (inventory?.items ?? []).map((item) => {
        const ref = itemRef(item);
        const armor = ref?.kind === "rule" ? equipment[ref.key] : null;
        return {
          key: item.id,
          label: itemLabel(item),
          equipped: item.equipped ?? false,
          modifiers: armor ? [armorAcModifier(armor, dexMod, `item:${item.id}`, itemLabel(item))] : [],
        };
      }),
    [inventory, equipment, dexMod]
  );

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of remainingChoices) {
    const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = { key, label: choice.label, source: "choice", modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label) };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: character.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
      })),
    abilities: { assigned: character.abilities.base },
    featureKeys: [...Object.keys(ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(build, { classes: ruleset.classes, features: { ...ruleset.features, ...choiceFeatures } }, equippedItems, []);

  const classFeatures = Object.values(ruleset.features).filter((f) => f.source === "class");
  const featureRefs = useMemo(() => classFeatures.map((f) => ({ kind: "rule" as const, key: f.key })), [classFeatures]);
  const featureChips = useReferenceChips(worldSlug, featureRefs);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <p className="text-lg font-semibold text-ink">
            {sheet.ac.value}{" "}
            <span className="text-xs font-normal text-ink-muted">
              = {sheet.ac.sources.map((s) => `${s.value} (${s.label})`).join(" + ") || "aucune source"}
            </span>
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">PV</span>
          <p className="text-lg font-semibold text-ink">
            {sheet.hitPoints.max} <span className="text-xs font-normal text-ink-muted">({sheet.hitPoints.hitDice})</span>
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Vitesse</span>
          <p className="text-lg font-semibold text-ink">{sheet.speed.value} m</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Bonus de maitrise</span>
          <p className="text-lg font-semibold text-ink">+{sheet.proficiencyBonus}</p>
        </div>
      </div>

      {sheet.warnings.length > 0 && (
        <div className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
          <p className="font-semibold">Personnage illégal — enregistrable quand même :</p>
          <ul className="list-inside list-disc">
            {sheet.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {remainingChoices.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Choix restants</span>
          {remainingChoices.map((choice) => {
            const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
            return (
              <div key={choice.id} className="text-sm">
                <p className="text-ink-muted">
                  {choice.label} ({chosen.length}/{choice.count})
                </p>
                <div className="flex flex-wrap gap-2">
                  {choice.options.map((option) => (
                    <label key={option} className="flex items-center gap-1 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={chosen.includes(option)}
                        onChange={() =>
                          onUpdateChoices({ ...character.choices, [choice.id]: toggleChoice(chosen, option, choice.count) })
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {classFeatures.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes accordées</span>
          <div className="flex flex-wrap gap-2">
            {classFeatures.map((f) => {
              const chip = featureChips.get(refIdentity({ kind: "rule", key: f.key }));
              return chip?.found ? (
                <RuleChip key={f.key} href={chip.href} label={chip.name} summary={chip.summary} />
              ) : (
                <span key={f.key} className="text-xs italic text-ink-muted">
                  {f.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
        {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => (
          <span key={ability}>
            {ABILITY_LABELS[ability]} {sheet.abilities[ability].score} ({sheet.abilities[ability].mod >= 0 ? "+" : ""}
            {sheet.abilities[ability].mod})
          </span>
        ))}
      </div>
    </div>
  );
}
