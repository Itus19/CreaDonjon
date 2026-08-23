"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { RemainingChoiceView } from "@/components/blocks/useResolvedRuleset";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";
import { SKILL_LABELS_FR, LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/sheet";
import type { LanguageKey } from "@/src/core/rules/srdMapping";

/**
 * Etape 6 (specs/wiki-liens-et-personnages.md §B8) : "une liste, pas un
 * tunnel" — tous les choix non resolus (competences, langues) affiches d'un
 * bloc, modifiables jusqu'au bout. Meme donnee que les onglets Traits/aside
 * de la fiche jouable (`character.choices`), meme fonction `toggleChoice`.
 */
export default function RemainingChoicesStep({
  remainingChoices,
  character,
  patchCharacter,
}: {
  remainingChoices: RemainingChoiceView[];
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
}) {
  if (remainingChoices.length === 0) {
    return <p className="text-sm text-ink-muted">Aucun choix en attente pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {remainingChoices.map((choice) => {
        const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
        return (
          <div key={choice.id} className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-muted">
              {choice.label} : {chosen.length}/{choice.count} choisie(s)
            </p>
            <div className="flex flex-wrap gap-2">
              {choice.options.map((option) => {
                const isChosen = chosen.includes(option);
                const canPick = isChosen || chosen.length < choice.count;
                const label = choice.kind === "language" ? LANGUAGE_LABELS_FR[option as LanguageKey] ?? option : SKILL_LABELS_FR[option as Skill] ?? option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!canPick}
                    onClick={() =>
                      patchCharacter({
                        choices: { ...character.choices, [choice.id]: toggleChoice(chosen, option, choice.count) },
                      })
                    }
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
