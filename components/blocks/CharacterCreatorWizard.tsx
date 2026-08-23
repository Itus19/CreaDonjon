"use client";

import { useMemo, useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import { RuleSelect, StatBadge, GENDER_OPTIONS, genderDropdownValue } from "./CharacterSheetHeader";
import Dropdown from "@/components/shared/Dropdown";
import InventoryTab from "./InventoryTab";
import AbilityScoreStep, { EMPTY_ABILITY_POOL_ASSIGNMENT, type AbilityPoolAssignment } from "./characterCreatorSteps/AbilityScoreStep";
import RemainingChoicesStep from "./characterCreatorSteps/RemainingChoicesStep";
import LevelClassesStep from "./characterCreatorSteps/LevelClassesStep";
import { createCharacterFromWizardAction } from "@/app/m/[worldSlug]/mj/creation-personnage/actions";

const SPECIES_TYPES = ["species"] as const;
const BACKGROUND_TYPES = ["background"] as const;

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

const STEPS = ["Espèce", "Classe", "Caractéristiques", "Historique", "Équipement", "Choix restants", "Aperçu"] as const;

function ruleRef(key: string): BlockReference | null {
  return key.trim() ? { kind: "rule", key: key.trim() } : null;
}

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
 * Aucune etape "sorts" : hors perimetre de §B8, laisse au bloc `spellcasting`
 * ajoutable ensuite comme aujourd'hui (menu "+ Incantation").
 */
export default function CharacterCreatorWizard({ worldSlug, worldId }: { worldSlug: string; worldId: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [character, setCharacter] = useState<CharacterBlockData>(EMPTY_CHARACTER);
  const [inventory, setInventory] = useState<InventoryBlockData>(EMPTY_INVENTORY);
  const [abilityPool, setAbilityPool] = useState<AbilityPoolAssignment>(EMPTY_ABILITY_POOL_ASSIGNMENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchCharacter(fields: Partial<CharacterBlockData>) {
    setCharacter((prev) => ({ ...prev, ...fields }));
  }

  const { remainingChoices, sheet, weaponByKey, equipment, weight, cost, proficiencies, languages, isMonk } = useCharacterSheetContext(
    worldSlug,
    character,
    inventory,
    undefined
  );

  const buildRefs = useMemo(() => {
    const refs: BlockReference[] = [];
    if (character.species) refs.push(character.species);
    if (character.background) refs.push(character.background);
    for (const c of character.classes) {
      if (c.class.kind === "rule" && c.class.key) refs.push(c.class);
      if (c.subclass) refs.push(c.subclass);
    }
    return refs;
  }, [character.species, character.background, character.classes]);
  const buildChips = useReferenceChips(worldSlug, buildRefs);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await createCharacterFromWizardAction(worldSlug, {
        worldId,
        name,
        character,
        inventory: inventory.items.length > 0 ? inventory : undefined,
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

      {step === 0 && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Espèce
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={character.species?.kind === "rule" ? character.species.key : ""}
              onChange={(key) => patchCharacter({ species: ruleRef(key) })}
              emptyLabel="Aucune espèce"
              chip={character.species ? buildChips.get(refIdentity(character.species)) : undefined}
            />
          </label>
          {character.species && buildChips.get(refIdentity(character.species))?.summary && (
            <p className="text-xs text-ink-muted">{buildChips.get(refIdentity(character.species))?.summary}</p>
          )}
        </div>
      )}

      {step === 1 && <LevelClassesStep worldSlug={worldSlug} character={character} patchCharacter={patchCharacter} />}

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
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Historique
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={BACKGROUND_TYPES}
              value={character.background?.kind === "rule" ? character.background.key : ""}
              onChange={(key) => patchCharacter({ background: ruleRef(key) })}
              emptyLabel="Aucun historique"
              chip={character.background ? buildChips.get(refIdentity(character.background)) : undefined}
            />
          </label>
          {character.background && buildChips.get(refIdentity(character.background))?.summary && (
            <p className="text-xs text-ink-muted">{buildChips.get(refIdentity(character.background))?.summary}</p>
          )}
        </div>
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

      {step === 6 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex w-12 shrink-0 flex-col items-center gap-1">
              <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
              <div
                className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
                style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
              >
                <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>
              </div>
            </div>
            <StatBadge label="Initiative" value={`${sheet.abilities.dex.mod >= 0 ? "+" : ""}${sheet.abilities.dex.mod}`} />
            <StatBadge label="Vitesse" value={`${sheet.speed.value} m`} />
            <StatBadge label="Points de vie" value={String(sheet.hitPoints.max)} />
            <StatBadge label="Maîtrise" value={`+${sheet.proficiencyBonus}`} />
          </div>

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
