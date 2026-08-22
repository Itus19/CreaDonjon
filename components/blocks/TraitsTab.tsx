"use client";

import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { ResolvedFeature } from "@/src/core/rules/sheet";
import { SRD_LANGUAGES, type LanguageKey } from "@/src/core/rules/srdMapping";
import type { RemainingChoiceView, TraitGrantView } from "./useResolvedRuleset";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { LANGUAGE_LABELS_FR } from "@/src/i18n/fr";
import { toggleChoice } from "./characterChoiceUtils";

/** Langues triées par libellé FR (V1-C7), même motif que SORTED_SKILLS (parent). */
const SORTED_LANGUAGES = [...SRD_LANGUAGES].sort((a, b) => LANGUAGE_LABELS_FR[a].localeCompare(LANGUAGE_LABELS_FR[b]));

/**
 * Onglet Traits de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5 — pur découpage, aucun changement de
 * comportement) : aptitudes accordées, maîtrises, langues (fixes + choix
 * restants).
 */
export default function TraitsTab({
  traits,
  traitChips,
  traitSourceLabel,
  proficiencies,
  languageChoices,
  character,
  patchCharacter,
  allLanguages,
}: {
  traits: ResolvedFeature[];
  traitChips: Map<string, ResolvedChipView>;
  traitSourceLabel: (f: ResolvedFeature) => string;
  proficiencies: TraitGrantView[];
  languageChoices: Map<string, RemainingChoiceView>;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  allLanguages: TraitGrantView[];
}) {
  function traitRefKey(f: ResolvedFeature): string {
    return f.key === f.source && f.source.includes(":") ? f.source.slice(f.source.indexOf(":") + 1) : f.key;
  }

  return (
    <div className="flex flex-col gap-1 pt-3 text-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Aptitudes accordées</span>
      {traits.length > 0 ? (
        <div className="flex flex-col gap-2">
          {traits.map((f) => {
            const chip = traitChips.get(refIdentity({ kind: "rule", key: traitRefKey(f) }));
            return (
              <div key={f.key} className="rounded-md border border-edge/60 bg-panel-raised p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  {chip?.found ? (
                    <Link
                      href={chip.href}
                      className="text-sm font-semibold no-underline hover:underline"
                      style={{ color: "var(--link-rule)" }}
                    >
                      {chip.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold italic text-ink-muted">{f.label}</span>
                  )}
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">{traitSourceLabel(f)}</span>
                </div>
                {chip?.found && chip.summary && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{chip.summary}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune aptitude accordée pour l&apos;instant.</p>
      )}

      <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">Maîtrises</span>
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
