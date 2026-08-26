"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { ABILITIES, type Ability, type DerivedSheet } from "@/src/core/rules/sheet";
import { isValidAsiChoice, parseAsiChoice, type AsiChoice } from "@/src/core/rules/abilityScoreImprovement";
import { ABILITY_LABELS } from "../PlayableCharacterSheet";

/** Un niveau d'ASI a traiter (V2-G1) — resolu en amont par `LevelUpWizard` a partir de `asiGrantedLevels`, jamais devine ici. */
export interface AsiGrant {
  /** Cle de `character.choices`, format `"<classe>.l<niveau>.asi"`. */
  choiceKey: string;
  className: string;
  level: number;
}

const ASI_ABILITY_CAP = 20;
const EMPTY_CHOICE: AsiChoice = { kind: "asi", increases: {} };

function currentChoice(character: CharacterBlockData, choiceKey: string): AsiChoice {
  return parseAsiChoice(character.choices[choiceKey]) ?? EMPTY_CHOICE;
}

/**
 * Etape "Amelioration de caracteristique" (V2-G1, montee de niveau
 * accompagnee) : une carte par niveau d'ASI traverse — une remontee de PX
 * peut en franchir plusieurs d'un coup, chacun un choix independant, sa
 * propre cle. +2 sur une caracteristique ou +1 sur deux, jamais une saisie
 * libre : la validite (`isValidAsiChoice`) est garantie par construction
 * (un radio de mode, pas un champ numerique) plutot que verifiee apres
 * coup. Le plafond de 20 se lit sur le score EFFECTIF actuel
 * (`sheet.abilities[x].score`, deja resolu par toutes les couches
 * precedentes), avant que ce choix lui-meme n'ajoute son propre
 * modificateur.
 */
export default function AsiStep({
  character,
  patchCharacter,
  sheet,
  grants,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  sheet: DerivedSheet;
  grants: AsiGrant[];
}) {
  // Le mode choisi ("+2" ou "+1 x2") AVANT toute caracteristique cochee ne
  // peut pas se lire depuis `choice.increases` seul : les deux modes
  // partent du meme choix vide, rien ne les distingue tant que l'utilisateur
  // n'a pas clique une premiere caracteristique. Etat purement local, un
  // par grant — une fois au moins une caracteristique choisie, le mode se
  // relit depuis la donnee persistee elle-meme (fiable meme apres un
  // rechargement de la fiche).
  const [pendingModeByKey, setPendingModeByKey] = useState<Record<string, "double" | "split">>({});

  function setChoice(choiceKey: string, choice: AsiChoice) {
    patchCharacter({ choices: { ...character.choices, [choiceKey]: choice } });
  }

  return (
    <div className="flex flex-col gap-5">
      {grants.map((grant) => {
        const choice = currentChoice(character, grant.choiceKey);
        const entries = Object.entries(choice.increases);
        const mode: "double" | "split" | null =
          entries.length > 0 ? (entries[0][1] === 2 ? "double" : "split") : (pendingModeByKey[grant.choiceKey] ?? null);

        function selectMode(next: "double" | "split") {
          if (mode === next) return;
          setPendingModeByKey((prev) => ({ ...prev, [grant.choiceKey]: next }));
          setChoice(grant.choiceKey, EMPTY_CHOICE);
        }

        function toggleAbility(ability: Ability) {
          if (!mode) return;
          const amount = mode === "double" ? 2 : 1;
          const increases = { ...choice.increases };
          if (increases[ability]) {
            delete increases[ability];
            setChoice(grant.choiceKey, { kind: "asi", increases });
            return;
          }
          if (sheet.abilities[ability].score + amount > ASI_ABILITY_CAP) return;
          if (mode === "double") {
            setChoice(grant.choiceKey, { kind: "asi", increases: { [ability]: 2 } });
            return;
          }
          if (Object.keys(increases).length >= 2) return;
          increases[ability] = 1;
          setChoice(grant.choiceKey, { kind: "asi", increases });
        }

        return (
          <div key={grant.choiceKey} className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
            <p className="text-sm font-medium text-ink">
              Amélioration de caractéristique — {grant.className} niv. {grant.level}
            </p>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => selectMode("double")}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  mode === "double" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                }`}
              >
                +2 une caractéristique
              </button>
              <button
                type="button"
                onClick={() => selectMode("split")}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  mode === "split" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                }`}
              >
                +1 deux caractéristiques
              </button>
            </div>

            {mode && (
              <div className="flex flex-wrap gap-2">
                {ABILITIES.map((ability) => {
                  const amount = mode === "double" ? 2 : 1;
                  const isChosen = Boolean(choice.increases[ability]);
                  // `sheet` est deja recalcule avec CE choix applique des qu'il
                  // est coche (patchCharacter declenche useCharacterSheetContext
                  // immediatement) : `score` inclut donc deja son propre bonus.
                  // Le score "avant" doit le retrancher, sous peine d'un double
                  // comptage a l'affichage (ex. 10 -> 14 au lieu de 10 -> 12).
                  const baseScore = isChosen ? sheet.abilities[ability].score - amount : sheet.abilities[ability].score;
                  const nextScore = baseScore + amount;
                  const wouldExceedCap = !isChosen && nextScore > ASI_ABILITY_CAP;
                  const choiceFull = mode === "split" && !isChosen && entries.length >= 2;
                  const disabled = wouldExceedCap || choiceFull;
                  return (
                    <button
                      key={ability}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleAbility(ability)}
                      title={wouldExceedCap ? "Plafond de 20 atteint" : undefined}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                      }`}
                    >
                      {ABILITY_LABELS[ability]} {baseScore} → {nextScore}
                    </button>
                  );
                })}
              </div>
            )}

            {mode && !isValidAsiChoice(choice) && (
              <p className="text-xs text-ink-muted">
                Choisissez {mode === "double" ? "une caractéristique" : "deux caractéristiques"} pour continuer.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
