"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { RemainingChoiceView, TraitGrantView } from "@/components/blocks/useResolvedRuleset";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";
import { SKILL_LABELS_FR, LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/sheet";
import type { LanguageKey } from "@/src/core/rules/srdMapping";
import { useWorldRuleEntries } from "../useWorldRuleEntries";

/**
 * Etape 6 (specs/wiki-liens-et-personnages.md §B8) : "une liste, pas un
 * tunnel" — tous les choix non resolus (competences, langues, maitrise
 * d'armes) affiches d'un bloc, modifiables jusqu'au bout. Meme donnee que
 * les onglets Traits/aside de la fiche jouable (`character.choices`), meme
 * fonction `toggleChoice`. Le choix de maitrise d'armes (retour utilisateur,
 * V2-G1) vient d'`assembleResolvedRuleset` comme competences/langues — ici,
 * `weaponEntries` sert uniquement a traduire ses options (des cles de fiche
 * d'arme, jamais des codes statiques comme les competences/langues) en noms
 * affichables.
 *
 * Affiche aussi les maitrises FIXES (armure/arme/outil deja accordees sans
 * choix) a part, dans "Deja acquis". Les LANGUES fixes (ex. le Commun)
 * vivent depuis peu directement dans la liste "Langues" elle-meme (retour
 * utilisateur, V2-G1 : "j'aimerais que la selection soit dans les langues
 * pas au dessus... sous la forme d'un bouton de langue selectionne") —
 * rendues comme des boutons deja coches, non desactivables, avant les
 * options reelles du choix. Jamais comptees dans le "X/Y choisie(s)" du
 * choix (`extractLanguages`/`extractLanguageChoice` separent deja
 * correctement l'acquis fixe du choix cote serveur — le Commun n'apparait
 * jamais dans les options d'un choix de langue).
 */
export default function RemainingChoicesStep({
  worldSlug,
  remainingChoices,
  character,
  patchCharacter,
  proficiencies,
  languages,
}: {
  worldSlug: string;
  remainingChoices: RemainingChoiceView[];
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  proficiencies: TraitGrantView[];
  languages: TraitGrantView[];
}) {
  const weaponNameByKey = new Map(useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "weapon").map((e) => [e.key, e.name]));

  // Attachees au PREMIER choix de langue rencontre seulement — en pratique
  // il n'y en a jamais qu'un, mais deux choix de langue simultanes (rare,
  // improbable) ne doivent pas les repeter deux fois.
  const firstLanguageChoiceId = remainingChoices.find((c) => c.kind === "language")?.id;

  return (
    <div className="flex flex-col gap-4">
      {proficiencies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Déjà acquis (espèce, historique)</span>
          <div className="flex flex-wrap gap-2">
            {proficiencies.map((g) => (
              <span
                key={`${g.source}:${g.key}`}
                title={`Source : ${g.source}`}
                className="inline-flex items-center gap-1 rounded-full border border-edge px-2.5 py-1 text-xs text-ink"
              >
                {g.name}
                <span className="text-[10px] text-ink-muted">· {g.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {remainingChoices.length === 0 && <p className="text-sm text-ink-muted">Aucun choix en attente pour l&apos;instant.</p>}

      {remainingChoices.map((choice) => {
        const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
        const grantedLanguages = choice.id === firstLanguageChoiceId ? languages : [];
        return (
          <div key={choice.id} className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-muted">
              {choice.label} : {chosen.length}/{choice.count} choisie(s)
            </p>
            <div className="flex flex-wrap gap-2">
              {grantedLanguages.map((g) => (
                <span
                  key={`granted:${g.key}`}
                  title={`Déjà acquis · ${g.source}`}
                  className="rounded-full border border-accent bg-accent/20 px-2.5 py-1 text-xs text-accent"
                >
                  {LANGUAGE_LABELS_FR[g.key as LanguageKey] ?? g.name}
                </span>
              ))}
              {choice.options.map((option) => {
                const isChosen = chosen.includes(option);
                const canPick = isChosen || chosen.length < choice.count;
                const label =
                  choice.kind === "language"
                    ? LANGUAGE_LABELS_FR[option as LanguageKey] ?? option
                    : choice.kind === "weapon_mastery"
                      ? weaponNameByKey.get(option) ?? option
                      : SKILL_LABELS_FR[option as Skill] ?? option;
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
