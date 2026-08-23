"use client";

import { useMemo } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { characterSheet, type CharacterBuild, type DerivedSheet, type EquippedItem, type ResolvedFeature } from "@/src/core/rules/sheet";
import { armorAcModifier, mapChosenSkillModifiers, type ArmorData, type ItemCost, type WeaponData } from "@/src/core/rules/srdMapping";
import { totalCarriedWeight } from "@/src/core/rules/encumbrance";
import { useResolvedRuleset, type RemainingChoiceView, type TraitGrantView } from "./useResolvedRuleset";
import { useReferenceChips, type ResolvedChipView } from "./useReferenceChips";
import { itemLabel, itemRef } from "./inventoryItem";
import type { ResolvedRuleset } from "@/src/core/rules/sheet";
import { LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import type { LanguageKey } from "@/src/core/rules/srdMapping";

export interface CharacterSheetContext {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoiceView[];
  proficiencies: TraitGrantView[];
  languages: TraitGrantView[];
  equipment: Record<string, ArmorData | null>;
  weaponByKey: Record<string, WeaponData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
  spellLevels: Record<string, number | null>;
  classSelections: { key: string; level: number }[];
  isMonk: boolean;
  equippedItems: EquippedItem[];
  build: CharacterBuild;
  sheet: DerivedSheet;
  traits: ResolvedFeature[];
  /** Onglet Traits (V1-C9) : chips resolus des memes traits, pour un lien + resume vers leur fiche de regle. */
  traitChips: Map<string, ResolvedChipView>;
  /** Libelle de source d'un trait pour affichage — nom traduit de l'espece/l'historique/la classe qui l'accorde. */
  traitSourceLabel: (f: ResolvedFeature) => string;
  /** Choix de competences non resolus, indexes par option (V1-C4 suite) — memes cles que la liste fixe de competences. */
  skillChoices: Map<string, RemainingChoiceView>;
  /** Meme motif que `skillChoices`, pour les choix de langues (V1-C7). */
  languageChoices: Map<string, RemainingChoiceView>;
  /** Langues fixes + langues choisies (V1-C7), une seule liste pour l'affichage. */
  allLanguages: TraitGrantView[];
}

/**
 * Cle de reference reelle d'un trait (V1-C9). Les bundles espece/historique
 * portent une cle synthetique identique a leur source (`species:tiefling`),
 * pas une cle `ruleset_entries` — on retire le prefixe pour retomber sur la
 * vraie cle resolvable (`tiefling`). Aptitudes de classe et dons accordes
 * portent deja leur vraie cle dans `f.key` (`f.key !== f.source` alors).
 */
function traitRefKey(f: ResolvedFeature): string {
  return f.key === f.source && f.source.includes(":") ? f.source.slice(f.source.indexOf(":") + 1) : f.key;
}

/** Six 10 par defaut (aucun modificateur) — jamais affiche tel quel : `InventoryPanel` gate ses lignes Attaquer/Degats derriere `showAttackInfo`, jamais deduit de ce defaut. */
const DEFAULT_ABILITY_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/**
 * Assemble la fiche derivee d'un personnage (V1-C18) : extrait de
 * `PlayableCharacterSheet` (ou cette meme sequence vivait inline avant ce
 * ticket) pour etre reutilisable ailleurs — `InventoryBlockEditor` en a
 * besoin pour afficher les memes lignes Attaquer/Degats et la meme barre de
 * charge que l'onglet Inventaire de la fiche, sans dupliquer le calcul (le
 * moteur `characterSheet` empile 7 couches de modificateurs — une deuxieme
 * implementation, meme approximative, diverge tot ou tard). Verbatim de la
 * logique d'origine, aucun changement de comportement pour un vrai `character`.
 *
 * `character` optionnel (V1-C18) : un bloc d'inventaire autonome peut vivre
 * sur une entite sans fiche de personnage (boutique, coffre) — les regles
 * des hooks interdisent d'appeler ce hook conditionnellement, donc l'absence
 * se gere ici, pas chez l'appelant. Sans personnage, `classes`/`choices`
 * sont vides et les caracteristiques valent 10 (aucun modificateur) ; ces
 * valeurs ne doivent jamais s'afficher comme un vrai calcul (voir
 * `InventoryPanel.showAttackInfo`).
 */
export function useCharacterSheetContext(
  worldSlug: string,
  character: CharacterBlockData | undefined,
  inventory: InventoryBlockData | undefined,
  spellcasting: SpellcastingBlockData | undefined
): CharacterSheetContext {
  const characterClasses = useMemo(() => character?.classes ?? [], [character]);
  const speciesKey = character?.species?.kind === "rule" ? character.species.key : undefined;
  const backgroundKey = character?.background?.kind === "rule" ? character.background.key : undefined;
  const classSelections = useMemo(
    () =>
      characterClasses
        .filter((c) => c.class.kind === "rule" && c.class.key)
        .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level })),
    [characterClasses]
  );
  const isMonk = classSelections.some((c) => c.key === "monk");
  const equipmentKeys = useMemo(
    () => (inventory?.items ?? []).map(itemRef).filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule").map((r) => r.key),
    [inventory]
  );
  const spellKeys = useMemo(
    () => (spellcasting?.known ?? []).map((k) => k.ref).filter((r): r is { kind: "rule"; key: string } => r.kind === "rule").map((r) => r.key),
    [spellcasting]
  );

  const { ruleset, remainingChoices, proficiencies, languages, equipment, weaponByKey, weight, cost, spellLevels } = useResolvedRuleset(worldSlug, {
    species: speciesKey,
    background: backgroundKey,
    classes: classSelections,
    equipmentKeys,
    spellKeys,
  });

  const carriedWeight = useMemo(() => totalCarriedWeight(inventory?.items ?? [], weight), [inventory, weight]);

  const abilitiesBase = character?.abilities.base ?? DEFAULT_ABILITY_SCORES;
  const dexScore = abilitiesBase.dex;
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
    const chosen = (character?.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = { key, label: choice.label, source: "choice", modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label) };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: characterClasses
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
      })),
    abilities: { assigned: abilitiesBase },
    featureKeys: [...Object.keys(ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(
    build,
    { classes: ruleset.classes, features: { ...ruleset.features, ...choiceFeatures } },
    equippedItems,
    [],
    carriedWeight
  );

  const traits = Object.values(ruleset.features);

  const traitRefs = useMemo(() => traits.map((f) => ({ kind: "rule" as const, key: traitRefKey(f) })), [traits]);
  const traitChips = useReferenceChips(worldSlug, traitRefs);

  function traitSourceLabel(f: ResolvedFeature): string {
    if (f.source.startsWith("class:")) return ruleset.classes[f.source.slice(6)]?.label ?? f.source;
    return ruleset.features[f.source]?.label ?? f.source;
  }

  const skillChoices = useMemo(() => {
    const map = new Map<string, RemainingChoiceView>();
    for (const choice of remainingChoices) {
      if (choice.kind !== "skill") continue;
      for (const option of choice.options) {
        if (!map.has(option)) map.set(option, choice);
      }
    }
    return map;
  }, [remainingChoices]);

  const languageChoices = useMemo(() => {
    const map = new Map<string, RemainingChoiceView>();
    for (const choice of remainingChoices) {
      if (choice.kind !== "language") continue;
      for (const option of choice.options) {
        if (!map.has(option)) map.set(option, choice);
      }
    }
    return map;
  }, [remainingChoices]);

  const allLanguages = useMemo(() => {
    const chosenGrants: TraitGrantView[] = [];
    for (const choice of new Set(languageChoices.values())) {
      const chosen = (character?.choices[choice.id] as string[] | undefined) ?? [];
      const source = choice.label.replace(/ — langues$/, "");
      for (const key of chosen) {
        chosenGrants.push({ key, name: LANGUAGE_LABELS_FR[key as LanguageKey] ?? key, source });
      }
    }
    return [...languages, ...chosenGrants];
  }, [languages, languageChoices, character?.choices]);

  return {
    ruleset,
    remainingChoices,
    proficiencies,
    languages,
    equipment,
    weaponByKey,
    weight,
    cost,
    spellLevels,
    classSelections,
    isMonk,
    equippedItems,
    build,
    sheet,
    traits,
    traitChips,
    traitSourceLabel,
    skillChoices,
    languageChoices,
    allLanguages,
  };
}
