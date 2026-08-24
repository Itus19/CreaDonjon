"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { RemainingChoiceView } from "./useResolvedRuleset";
import type { ResolvedChipView } from "./useReferenceChips";
import { toggleChoice } from "./characterChoiceUtils";

/**
 * Onglet dedie a la maitrise d'armes (retour utilisateur, V2-G1) : liste
 * complete, modifiable a tout moment ici comme dans l'assistant de
 * creation, mais remise a zero a chaque repos long (`characterActions.ts`,
 * `takeLongRest` — texte SRD 2024 "Whenever you finish a Long Rest, you can
 * change..."). Ce composant ne fait que le choix ; la remise a zero vit
 * cote serveur avec le reste du repos long, jamais ici.
 */
export default function WeaponMasteryTab({
  choices,
  chips,
  characterChoices,
  onChangeChoices,
}: {
  choices: RemainingChoiceView[];
  chips: Map<string, ResolvedChipView>;
  characterChoices: CharacterBlockData["choices"];
  onChangeChoices: (choices: CharacterBlockData["choices"]) => void;
}) {
  if (choices.length === 0) {
    return <p className="pt-3 text-sm text-ink-muted">Aucune classe de ce personnage n&apos;accorde de maîtrise d&apos;armes.</p>;
  }

  return (
    <div className="flex flex-col gap-4 pt-3">
      {choices.map((choice) => {
        const chosen = (characterChoices[choice.id] as string[] | undefined) ?? [];
        return (
          <div key={choice.id} className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-muted">
              {choice.label} : {chosen.length}/{choice.count} choisie(s) — remis à zéro à chaque repos long
            </p>
            <div className="flex flex-wrap gap-2">
              {choice.options.map((option) => {
                const isChosen = chosen.includes(option);
                const canPick = isChosen || chosen.length < choice.count;
                const label = chips.get(`rule:${option}`)?.name ?? option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!canPick}
                    onClick={() => onChangeChoices({ ...characterChoices, [choice.id]: toggleChoice(chosen, option, choice.count) })}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
