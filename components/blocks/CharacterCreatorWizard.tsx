"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import { GENDER_OPTIONS, genderDropdownValue } from "./CharacterSheetHeader";
import Dropdown from "@/components/shared/Dropdown";
import InventoryTab from "./InventoryTab";
import AbilityScoreStep, { EMPTY_ABILITY_POOL_ASSIGNMENT, type AbilityPoolAssignment } from "./characterCreatorSteps/AbilityScoreStep";
import RemainingChoicesStep from "./characterCreatorSteps/RemainingChoicesStep";
import LevelClassesStep, { type ClassEquipmentChoiceState } from "./characterCreatorSteps/LevelClassesStep";
import SpeciesStep from "./characterCreatorSteps/SpeciesStep";
import BackgroundStep, { type BackgroundEquipmentChoice } from "./characterCreatorSteps/BackgroundStep";
import SpellSelectionStep from "./characterCreatorSteps/SpellSelectionStep";
import PreviewStep from "./characterCreatorSteps/PreviewStep";
import { createCharacterFromWizardAction } from "@/app/m/[worldSlug]/mj/creation-personnage/actions";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import { useRuleEntryBlocks } from "./useRuleEntryBlocks";

const EMPTY_CHARACTER: CharacterBlockData = {
  __v: 1,
  species: null,
  background: null,
  classes: [{ class: { kind: "rule", key: "" }, level: 1, subclass: null }],
  abilities: { method: "standard_array", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  choices: {},
  hp_method: "fixed",
  portrait_asset_id: null,
  gender: "unspecified",
  pronouns: "",
};

const EMPTY_INVENTORY: InventoryBlockData = {
  __v: 1,
  items: [],
  containers: [],
  currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

const EMPTY_SPELLCASTING: SpellcastingBlockData = {
  __v: 1,
  sources: [],
  known: [],
  prepared: [],
  slot_override: null,
};

const STEPS = [
  "Espèce",
  "Classe",
  "Caractéristiques",
  "Historique",
  "Équipement",
  "Compétences",
  "Sorts",
  "Aperçu",
] as const;

/**
 * Assistant de creation de personnage (V2-G1, ecran MJ — sur demande
 * explicite : "d'abord un outil complet dans l'ecran MJ avant de
 * l'integrer cote monde via un bloc"). Sept etapes
 * (specs/wiki-liens-et-personnages.md §B8) : espece, classe niveau 1,
 * caracteristiques, historique, equipement de depart, choix restants
 * (liste, pas un tunnel — modifiable jusqu'au bout), apercu.
 *
 * Reutilise le meme moteur de resolution que la fiche jouable
 * (`useCharacterSheetContext`, deja independant de tout entityId — un bloc
 * d'inventaire autonome s'en sert deja) : l'apercu en direct est calcule par
 * le vrai moteur de regles, pas une approximation propre a l'assistant.
 *
 * Huitieme etape "Sorts" ajoutee en plus de §B8 (retour utilisateur) : un
 * budget de cantrips/sorts par classe incantatrice, lu directement dans son
 * `class_progression` (`SpellSelectionStep.tsx`), ecrit dans le bloc
 * `spellcasting` — separe de `character`, cree a la validation seulement si
 * au moins un sort a ete choisi.
 */
export default function CharacterCreatorWizard({ worldSlug, worldId }: { worldSlug: string; worldId: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [character, setCharacter] = useState<CharacterBlockData>(EMPTY_CHARACTER);
  const [inventory, setInventory] = useState<InventoryBlockData>(EMPTY_INVENTORY);
  const [spellcasting, setSpellcasting] = useState<SpellcastingBlockData>(EMPTY_SPELLCASTING);
  const [abilityPool, setAbilityPool] = useState<AbilityPoolAssignment>(EMPTY_ABILITY_POOL_ASSIGNMENT);
  const [bgEquipmentChoice, setBgEquipmentChoice] = useState<BackgroundEquipmentChoice | null>(null);
  const [classEquipmentChoices, setClassEquipmentChoices] = useState<(ClassEquipmentChoiceState | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchCharacter(fields: Partial<CharacterBlockData>) {
    setCharacter((prev) => ({ ...prev, ...fields }));
  }

  // Prechargement des sorts en arriere-plan (retour utilisateur : "l'onglet
  // sorts prend vraiment longtemps a charger") — les blocs de tous les
  // sorts du monde (jusqu'a 339 sous le SRD 2024) ne dependent d'aucun choix
  // du joueur, seulement du monde ; `useRuleEntryBlocks` (cache module-level
  // partage par cle) permet donc de lancer cette requete des l'etape 1
  // (Espece) plutot que d'attendre l'etape 7 (Sorts) — le temps reel
  // d'aller-retour reseau (~1s, base Supabase hebergee) est alors deja passe
  // pendant que le joueur choisit espece/classe/historique/equipement, et
  // `SpellSelectionStep` retrouve le resultat en cache, instantanement.
  const allEntries = useWorldRuleEntries(worldSlug);
  const allSpellKeys = allEntries.filter((e) => e.entryType === "spell").map((e) => e.key);
  useRuleEntryBlocks(worldSlug, allSpellKeys);

  const {
    remainingChoices,
    sheet,
    weaponByKey,
    equipment,
    weight,
    cost,
    spellLevels,
    proficiencies,
    languages,
    isMonk,
    traits,
    traitChips,
    traitSourceLabel,
    languageChoices,
    allLanguages,
    itemChips,
    equippedWeapons,
    buildChips,
  } = useCharacterSheetContext(worldSlug, character, inventory, spellcasting);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await createCharacterFromWizardAction(worldSlug, {
        worldId,
        name,
        character,
        inventory: inventory.items.length > 0 ? inventory : undefined,
        spellcasting: spellcasting.known.length > 0 ? spellcasting : undefined,
      });
      if (result?.error) setError(result.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-edge/60 bg-panel-raised p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Nom du personnage
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom…"
            className="w-full max-w-sm rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Genre
          <Dropdown
            value={genderDropdownValue(character.gender)}
            options={GENDER_OPTIONS}
            onChange={(v) =>
              patchCharacter({
                gender:
                  v === "custom"
                    ? { custom: typeof character.gender === "object" ? character.gender.custom : "" }
                    : (v as Exclude<CharacterBlockData["gender"], { custom: string } | undefined>),
              })
            }
            aria-label="Genre"
          />
          {typeof character.gender === "object" && (
            <input
              value={character.gender.custom}
              onChange={(e) => patchCharacter({ gender: { custom: e.target.value } })}
              placeholder="préciser…"
              className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          )}
        </label>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-edge/60 pb-3 text-xs">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full border px-2.5 py-1 transition-colors ${
              step === i ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && <SpeciesStep worldSlug={worldSlug} character={character} patchCharacter={patchCharacter} />}

      {step === 1 && (
        <LevelClassesStep
          worldSlug={worldSlug}
          character={character}
          patchCharacter={patchCharacter}
          inventory={inventory}
          onUpdateInventory={setInventory}
          equipmentChoices={classEquipmentChoices}
          onChooseEquipmentChoices={setClassEquipmentChoices}
        />
      )}

      {step === 2 && (
        <AbilityScoreStep
          character={character}
          patchCharacter={patchCharacter}
          pool={abilityPool}
          onChangePool={setAbilityPool}
          sheet={sheet}
        />
      )}

      {step === 3 && (
        <BackgroundStep
          worldSlug={worldSlug}
          character={character}
          patchCharacter={patchCharacter}
          inventory={inventory}
          onUpdateInventory={setInventory}
          choice={bgEquipmentChoice}
          onChooseOption={setBgEquipmentChoice}
        />
      )}

      {step === 4 && (
        <InventoryTab
          worldSlug={worldSlug}
          inventory={inventory}
          onUpdateInventory={setInventory}
          strMod={sheet.abilities.str.mod}
          dexMod={sheet.abilities.dex.mod}
          proficiencyBonus={sheet.proficiencyBonus}
          isMonk={isMonk}
          weaponByKey={weaponByKey}
          equipment={equipment}
          weight={weight}
          cost={cost}
          encumbrance={sheet.encumbrance}
        />
      )}

      {step === 5 && (
        <RemainingChoicesStep
          remainingChoices={remainingChoices}
          character={character}
          patchCharacter={patchCharacter}
          proficiencies={proficiencies}
          languages={languages}
        />
      )}

      {step === 6 && <SpellSelectionStep worldSlug={worldSlug} character={character} spellcasting={spellcasting} onUpdateSpellcasting={setSpellcasting} />}

      {step === 7 && (
        <div className="flex flex-col gap-3">
          <PreviewStep
            worldSlug={worldSlug}
            character={character}
            patchCharacter={patchCharacter}
            inventory={inventory}
            onUpdateInventory={setInventory}
            spellcasting={spellcasting}
            onUpdateSpellcasting={setSpellcasting}
            spellLevels={spellLevels}
            sheet={sheet}
            traits={traits}
            traitChips={traitChips}
            traitSourceLabel={traitSourceLabel}
            proficiencies={proficiencies}
            languageChoices={languageChoices}
            allLanguages={allLanguages}
            weaponByKey={weaponByKey}
            equipment={equipment}
            weight={weight}
            cost={cost}
            itemChips={itemChips}
            equippedWeapons={equippedWeapons}
            isMonk={isMonk}
            buildChips={buildChips}
          />

          {sheet.warnings.length > 0 && (
            <div className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
              <p className="font-semibold">Personnage illégal — créable quand même :</p>
              <ul className="list-inside list-disc">
                {sheet.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={submit}
            className="w-fit rounded-full border border-accent px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            title={!name.trim() ? "Donnez un nom au personnage d'abord" : undefined}
          >
            Créer le personnage
          </button>
        </div>
      )}

      <div className="flex justify-between border-t border-edge/60 pt-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-30"
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-30"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
