"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import { useRuleEntryBlocks } from "./useRuleEntryBlocks";
import LevelClassesStep, { type ClassEquipmentChoiceState } from "./characterCreatorSteps/LevelClassesStep";
import AsiStep, { type AsiGrant } from "./characterCreatorSteps/AsiStep";
import RemainingChoicesStep from "./characterCreatorSteps/RemainingChoicesStep";
import SpellSelectionStep from "./characterCreatorSteps/SpellSelectionStep";

const EMPTY_INVENTORY: InventoryBlockData = {
  __v: 1,
  items: [],
  containers: [],
  currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

function classKeyOf(c: CharacterBlockData["classes"][number]): string | null {
  return c.class.kind === "rule" && c.class.key ? c.class.key : null;
}

export interface LevelUpWizardDoneResult {
  character: { id: string; data: unknown; version: number };
  spellcasting?: { id: string; data: unknown; version: number };
}

/**
 * Montee de niveau accompagnee (V2-G1, docs/BACKLOG_V2.md) : rejoue la
 * partie utile du parcours de creation — ajouter un niveau a une classe
 * existante ou en demarrer une nouvelle (multiclassage), puis les seuls
 * choix que ce niveau debloque — plutot que de rouvrir tout l'assistant de
 * creation. Un composant SEPARE de `CharacterCreatorWizard` (pas un
 * troisieme mode) : `entityMode` sur ce dernier ne change jamais quelles
 * etapes s'affichent, seulement ce qui se passe a la validation — la
 * montee de niveau a besoin des deux a la fois (moins d'etapes, sauvegarde
 * chirurgicale qui ne renomme rien et ne touche ni l'inventaire ni
 * l'espece).
 *
 * Reutilise sans modification `LevelClassesStep`/`RemainingChoicesStep`/
 * `SpellSelectionStep` — ces deux derniers sont deja ecrits en "budget
 * total moins deja choisi", recalcule au niveau courant : rien a changer
 * pour qu'ils n'affichent que ce qu'un niveau supplementaire debloque de
 * neuf. `AsiStep` est nouveau (aucune etape existante ne geculait
 * l'amelioration de caracteristique). L'etape Aperceu, elle, n'est PAS
 * `PreviewStep` (qui fabrique un personnage flambant neuf : PV max, 0 PX —
 * correct a la creation, trompeur ici ou l'entite a un etat de jeu reel) :
 * un resume plus simple, propre a ce contexte.
 */
export default function LevelUpWizard({
  worldSlug,
  entityId,
  campaignId,
  expectedVersion,
  initialCharacter,
  initialInventory,
  initialSpellcasting,
  onCancel,
  onDone,
}: {
  worldSlug: string;
  entityId: string;
  campaignId: string | null;
  expectedVersion: number;
  initialCharacter: CharacterBlockData;
  initialInventory: InventoryBlockData;
  initialSpellcasting: SpellcastingBlockData | undefined;
  onCancel: () => void;
  onDone: (result: LevelUpWizardDoneResult) => void;
}) {
  const [rawStep, setStep] = useState(0);
  const [character, setCharacter] = useState<CharacterBlockData>(initialCharacter);
  const [spellcasting, setSpellcasting] = useState<SpellcastingBlockData>(
    initialSpellcasting ?? { __v: 1, sources: [], known: [], prepared: [], slot_override: null }
  );
  const [equipmentChoices, setEquipmentChoices] = useState<(ClassEquipmentChoiceState | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Niveau de chaque classe AVANT la montee, fige au montage (jamais mis a
  // jour ensuite — un ref se lirait pendant le rendu, react-hooks/refs) :
  // c'est la reference qui determine ce qu'un niveau supplementaire
  // debloque de neuf.
  const [oldLevelByKey] = useState<Map<string, number>>(
    () => new Map(initialCharacter.classes.map((c) => [classKeyOf(c), c.level]).filter((e): e is [string, number] => e[0] !== null))
  );

  function patchCharacter(fields: Partial<CharacterBlockData>) {
    setCharacter((prev) => ({ ...prev, ...fields }));
  }

  const {
    sheet,
    ruleset,
    remainingChoices,
    proficiencies,
    languages,
    skillChoices,
    asiGrantedLevels,
  } = useCharacterSheetContext(worldSlug, character, initialInventory, spellcasting);

  const classKeys = character.classes.map(classKeyOf).filter((k): k is string => k !== null);
  const classBlocksByKey = useRuleEntryBlocks(worldSlug, classKeys);
  const hasSpellcastingClass = classKeys.some((key) => classBlocksByKey[key]?.some((b) => b.blockType === "spellcasting_progression"));

  // Precharge les sorts en arriere-plan (meme motif que CharacterCreatorWizard) :
  // le temps d'aller-retour est deja passe une fois l'etape Sorts atteinte.
  const allEntries = useWorldRuleEntries(worldSlug);
  useRuleEntryBlocks(worldSlug, hasSpellcastingClass ? allEntries.filter((e) => e.entryType === "spell").map((e) => e.key) : []);

  const asiGrants: AsiGrant[] = [];
  for (const slot of character.classes) {
    const classKey = classKeyOf(slot);
    if (!classKey) continue;
    const oldLevel = oldLevelByKey.get(classKey) ?? 0;
    if (slot.level <= oldLevel) continue;
    const grantedLevels = (asiGrantedLevels[classKey] ?? []).filter((lvl) => lvl > oldLevel && lvl <= slot.level);
    for (const level of grantedLevels) {
      asiGrants.push({
        choiceKey: `${classKey}.l${level}.asi`,
        className: ruleset.classes[classKey]?.label ?? classKey,
        level,
      });
    }
  }

  const totalLevelBefore = initialCharacter.classes.reduce((sum, c) => sum + c.level, 0);
  const totalLevelAfter = character.classes.reduce((sum, c) => sum + c.level, 0);

  const steps = [
    "Classe",
    ...(asiGrants.length > 0 ? ["Caractéristiques"] : []),
    ...(remainingChoices.length > 0 ? ["Compétences"] : []),
    ...(hasSpellcastingClass ? ["Sorts"] : []),
    "Aperçu",
  ] as const;
  const step = Math.min(rawStep, steps.length - 1);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${entityId}/actions/level-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          expectedVersion,
          character,
          spellcasting: spellcasting.known.length > 0 ? spellcasting : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Échec de la montée de niveau.");
        return;
      }
      const result = (await res.json()) as { character: { id: string; data: unknown; version: number }; spellcasting?: { id: string; data: unknown; version: number } };
      onDone(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-edge/60 bg-panel-raised p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          Montée de niveau — niveau {totalLevelBefore} → {totalLevelAfter}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel"
        >
          Fermer sans enregistrer
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-edge/60 pb-3 text-xs">
        {steps.map((label, i) => (
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

      {steps[step] === "Classe" && (
        <LevelClassesStep
          worldSlug={worldSlug}
          character={character}
          patchCharacter={patchCharacter}
          inventory={EMPTY_INVENTORY}
          onUpdateInventory={() => {}}
          equipmentChoices={equipmentChoices}
          onChooseEquipmentChoices={setEquipmentChoices}
          hideEquipment
        />
      )}

      {steps[step] === "Caractéristiques" && <AsiStep character={character} patchCharacter={patchCharacter} sheet={sheet} grants={asiGrants} />}

      {steps[step] === "Compétences" && (
        <RemainingChoicesStep
          worldSlug={worldSlug}
          remainingChoices={remainingChoices}
          character={character}
          patchCharacter={patchCharacter}
          proficiencies={proficiencies}
          languages={languages}
          sheet={sheet}
          skillChoices={skillChoices}
        />
      )}

      {steps[step] === "Sorts" && (
        <SpellSelectionStep worldSlug={worldSlug} character={character} spellcasting={spellcasting} onUpdateSpellcasting={setSpellcasting} />
      )}

      {steps[step] === "Aperçu" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 p-3 text-sm">
            <p className="text-ink">
              Niveau total : <strong>{totalLevelBefore}</strong> → <strong>{totalLevelAfter}</strong>
            </p>
            <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
              {character.classes.map((c, i) => {
                const key = classKeyOf(c);
                const label = key ? (ruleset.classes[key]?.label ?? key) : "—";
                return (
                  <li key={i}>
                    {label} niv. {c.level}
                  </li>
                );
              })}
            </ul>
            <p className="text-ink-muted">
              Points de vie maximum : <span className="text-ink">{sheet.hitPoints.max}</span>
            </p>
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

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-fit rounded-full border border-accent px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            Confirmer la montée de niveau
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
          disabled={step === steps.length - 1}
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-30"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
