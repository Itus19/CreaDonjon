"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { SRD_LANGUAGES, type LanguageKey } from "@/src/core/rules/srdMapping";
import { LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import type { RemainingChoiceView, TraitGrantView } from "./useResolvedRuleset";
import type { ResolvedChipView } from "./useReferenceChips";
import { toggleChoice } from "./characterChoiceUtils";

/** Langues triées par libellé FR (V1-C7), même motif que SORTED_SKILLS (`PlayableCharacterSheet`). */
const SORTED_LANGUAGES = [...SRD_LANGUAGES].sort((a, b) => LANGUAGE_LABELS_FR[a].localeCompare(LANGUAGE_LABELS_FR[b]));

/**
 * Onglet Maîtrises de la fiche jouable : tout ce que le personnage sait
 * manier ou parler — maîtrises d'armure/arme/outil, bottes d'arme, langues.
 *
 * Regroupement demandé par l'auteur : maîtrises et langues vivaient dans
 * l'onglet Traits, à côté des aptitudes accordées, alors que la maîtrise
 * d'armes avait déjà son onglet à elle. Trois listes de la même nature
 * réparties sur deux onglets, dont l'un ne portait qu'un seul sujet.
 *
 * Conséquence à ne pas manquer : cet onglet n'apparaissait que si une classe
 * accordait des bottes d'arme. Il porte maintenant les maîtrises et les
 * langues, que tout personnage possède — il est donc toujours affiché, sans
 * quoi un personnage sans botte n'aurait plus accès aux siennes.
 */
export default function MasteriesTab({
  proficiencies,
  masteryChoices,
  masteryChips,
  languageChoices,
  allLanguages,
  character,
  patchCharacter,
}: {
  proficiencies: TraitGrantView[];
  /** Vide = aucune classe n'accorde de botte d'arme : la section entière disparaît, plutôt qu'un titre suivi d'un message d'absence. */
  masteryChoices: RemainingChoiceView[];
  masteryChips: Map<string, ResolvedChipView>;
  languageChoices: Map<string, RemainingChoiceView>;
  allLanguages: TraitGrantView[];
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
}) {
  return (
    <div className="flex flex-col gap-1 pt-3 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Maîtrises</span>
      {proficiencies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {proficiencies.map((p) => (
            <span
              key={`${p.source}:${p.key}`}
              title={`Source : ${p.source}`}
              className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-sm text-ink"
            >
              {p.name}
              <span className="text-[10px] text-ink-muted">· {p.source}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune maîtrise d&apos;armure/arme/outil pour l&apos;instant.</p>
      )}

      {masteryChoices.length > 0 && (
        <>
          <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Maîtrise d&apos;armes</span>
          {masteryChoices.map((choice) => {
            const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
            return (
              <div key={choice.id} className="flex flex-col gap-1.5">
                {/* Modifiable a tout moment ici comme dans l'assistant de creation,
                    mais remis a zero a chaque repos long (`characterActions.ts`,
                    `takeLongRest` — texte SRD 2024 "Whenever you finish a Long Rest,
                    you can change..."). Ce composant ne fait que le choix ; la remise
                    a zero vit cote serveur avec le reste du repos long, jamais ici. */}
                <p className="text-xs text-ink-muted">
                  {choice.label} : {chosen.length}/{choice.count} choisie(s) — remis à zéro à chaque repos long
                </p>
                <div className="flex flex-wrap gap-2">
                  {choice.options.map((option) => {
                    const isChosen = chosen.includes(option);
                    const canPick = isChosen || chosen.length < choice.count;
                    const label = masteryChips.get(`rule:${option}`)?.name ?? option;
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={!canPick}
                        onClick={() =>
                          patchCharacter({ choices: { ...character.choices, [choice.id]: toggleChoice(chosen, option, choice.count) } })
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
        </>
      )}

      <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Langues</span>
      {[...new Set(languageChoices.values())].map((choice) => {
        const chosenForChoice = (character.choices[choice.id] as string[] | undefined) ?? [];
        return (
          <div key={choice.id} className="flex flex-col gap-1">
            <p className="text-xs text-ink-muted">
              {choice.label} : {chosenForChoice.length}/{choice.count} choisie(s) — cliquez pour choisir
            </p>
            <div className="flex flex-wrap gap-2">
              {SORTED_LANGUAGES.map((lang) => {
                const isChosen = chosenForChoice.includes(lang);
                const canPick = isChosen || chosenForChoice.length < choice.count;
                return (
                  <button
                    key={lang}
                    type="button"
                    disabled={!canPick}
                    onClick={() =>
                      patchCharacter({
                        choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, lang, choice.count) },
                      })
                    }
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isChosen ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    {LANGUAGE_LABELS_FR[lang as LanguageKey]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {allLanguages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allLanguages.map((l) => (
            <span
              key={`${l.source}:${l.key}`}
              title={`Source : ${l.source}`}
              className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-sm text-ink"
            >
              {l.name}
              <span className="text-[10px] text-ink-muted">· {l.source}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune langue accordée sans choix pour l&apos;instant.</p>
      )}
    </div>
  );
}
