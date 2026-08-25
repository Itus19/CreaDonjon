"use client";

import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { RemainingChoiceView, TraitGrantView } from "@/components/blocks/useResolvedRuleset";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";
import { SKILL_LABELS_FR, LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { SKILL_ABILITIES } from "@/src/core/rules/sheet";
import type { LanguageKey } from "@/src/core/rules/srdMapping";
import { useWorldRuleEntries } from "../useWorldRuleEntries";
import { SORTED_SKILLS, ABILITY_LABELS } from "../PlayableCharacterSheet";

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
  sheet,
  skillChoices,
}: {
  worldSlug: string;
  remainingChoices: RemainingChoiceView[];
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  proficiencies: TraitGrantView[];
  languages: TraitGrantView[];
  sheet: DerivedSheet;
  /** Choix de competences non resolus, indexes par option (V1-C4 suite) — meme donnee que la grille de competences ci-dessous, deja calculee par `useCharacterSheetContext`. */
  skillChoices: Map<string, RemainingChoiceView>;
}) {
  const weaponNameByKey = new Map(useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "weapon").map((e) => [e.key, e.name]));

  // Attachees au PREMIER choix de langue rencontre seulement — en pratique
  // il n'y en a jamais qu'un, mais deux choix de langue simultanes (rare,
  // improbable) ne doivent pas les repeter deux fois.
  const firstLanguageChoiceId = remainingChoices.find((c) => c.kind === "language")?.id;

  // Les choix de competences ne passent plus par la liste generique
  // ci-dessous (retour utilisateur, V2-G1) : la grille dediee tout en bas
  // les affiche avec la meme esthetique que la fiche jouable (rond dore,
  // modificateur en direct), competences non selectionnables comprises.
  const nonSkillChoices = remainingChoices.filter((c) => c.kind !== "skill");

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

      {nonSkillChoices.length === 0 && remainingChoices.length === 0 && (
        <p className="text-sm text-ink-muted">Aucun choix en attente pour l&apos;instant.</p>
      )}

      {nonSkillChoices.map((choice) => {
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
                  choice.kind === "language" ? LANGUAGE_LABELS_FR[option as LanguageKey] ?? option : weaponNameByKey.get(option) ?? option;
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

      {/* Grille de competences (retour utilisateur, V2-G1) : 3 colonnes de 6
          (les 18 competences du SRD), meme esthetique que la fiche jouable
          (`PlayableCharacterSheet.tsx`, rond dore + modificateur en direct)
          — deplacee en dernier dans cet onglet, plutot qu'une liste de
          pastilles a part comme les autres choix ci-dessus. Une competence
          proposee par le choix de classe reste cliquable (encre claire,
          rond a cocher) ; les autres restent visibles mais grisees, avec
          leur propre modificateur (deja maitrisees par ailleurs ou non). */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          Compétences · maîtrise {sheet.proficiencyBonus >= 0 ? "+" : ""}
          {sheet.proficiencyBonus}
        </span>
        {remainingChoices.some((c) => c.kind === "skill") && (
          <div className="flex flex-col gap-0.5">
            {remainingChoices
              .filter((c) => c.kind === "skill")
              .map((choice) => {
                const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
                return (
                  <p key={choice.id} className="text-xs text-ink-muted">
                    {choice.label} : {chosen.length}/{choice.count} choisie(s) — cliquez les ronds dorés ci-dessous
                  </p>
                );
              })}
          </div>
        )}
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          {SORTED_SKILLS.map((skill) => {
            const result = sheet.skills[skill];
            const choice = skillChoices.get(skill);
            const chosenForChoice = choice ? ((character.choices[choice.id] as string[] | undefined) ?? []) : [];
            const isChosen = choice ? chosenForChoice.includes(skill) : false;
            const canPick = choice ? isChosen || chosenForChoice.length < choice.count : false;

            function toggle() {
              if (!choice) return;
              patchCharacter({ choices: { ...character.choices, [choice.id]: toggleChoice(chosenForChoice, skill, choice.count) } });
            }

            const dotClass = choice
              ? isChosen
                ? "bg-accent"
                : canPick
                  ? "border-2 border-ink bg-transparent"
                  : "border border-edge bg-transparent opacity-40"
              : result.proficiency === "expertise"
                ? "bg-accent"
                : result.proficiency === "proficient"
                  ? "border border-accent bg-accent/40"
                  : "border border-edge bg-transparent";

            const dotTitle = choice
              ? isChosen
                ? `${choice.label} — choisie, cliquer pour retirer`
                : canPick
                  ? `${choice.label} — cliquer pour choisir (${chosenForChoice.length}/${choice.count})`
                  : `${choice.label} — choix déjà complet (${choice.count}/${choice.count})`
              : result.proficiency === "expertise"
                ? "Expertise"
                : result.proficiency === "proficient"
                  ? "Maîtrisée"
                  : "Non maîtrisée";

            const rowInk = choice ? "text-ink" : "text-ink-muted";

            return (
              <div key={skill} className="flex items-center gap-2 text-sm">
                {choice ? (
                  <button
                    type="button"
                    onClick={toggle}
                    disabled={!canPick}
                    title={dotTitle}
                    className="flex h-4 w-4 shrink-0 items-center justify-center disabled:cursor-not-allowed"
                  >
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                  </button>
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center" title={dotTitle}>
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                  </span>
                )}
                <span className={`flex-1 ${rowInk}`}>{SKILL_LABELS_FR[skill]}</span>
                <span className="text-[10px] uppercase text-ink-muted">{ABILITY_LABELS[SKILL_ABILITIES[skill]]}</span>
                <span className={`w-8 text-right font-medium ${rowInk}`}>
                  {result.mod >= 0 ? "+" : ""}
                  {result.mod}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
