"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { useWorldRuleEntries, useWorldRuleEntriesEtat } from "./useWorldRuleEntries";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useReferenceChips, type ResolvedChipView } from "./useReferenceChips";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";
import RangeeChiffree from "./RangeeChiffree";
import type { DeathSaves } from "@/src/core/rules/deathSaves";
import type { Concentration } from "@/src/core/schemas/runtimeState";
import type { EtatMourant } from "@/lib/ui/etatMourant";
import { useWorldCalendarContext } from "@/components/shared/WorldCalendarProvider";
import { birthYearFromAge } from "@/src/core/calendar/age";
import { ageWithDeath } from "@/src/core/genealogy/lifeDates";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { GameDate } from "@/src/core/calendar/types";

/** `StatBadge` vit dans `RangeeChiffree.tsx` (V3.1-34) ; réexporté ici pour ses importeurs (assistant de création). */
export { StatBadge } from "./RangeeChiffree";

const SPECIES_TYPES = ["species"] as const;
const BACKGROUND_TYPES = ["background"] as const;
const CLASS_TYPES = ["class"] as const;
const SUBCLASS_TYPES = ["subclass"] as const;

export const GENDER_OPTIONS = [
  { value: "unspecified", label: "Non précisé" },
  { value: "feminine", label: "Féminin" },
  { value: "masculine", label: "Masculin" },
  { value: "neutral", label: "Neutre" },
  { value: "custom", label: "Personnalisé" },
];

/** `unspecified` (on ne sait pas) et `neutral` (ni l'un ni l'autre) restent deux valeurs distinctes du menu — jamais fusionnees (V1-C4). */
export function genderDropdownValue(gender: CharacterBlockData["gender"]): string {
  if (!gender) return "unspecified";
  if (typeof gender === "object") return "custom";
  return gender;
}

/**
 * Champ d'age (V3-Z1), partage par la fiche et l'etape Identite de
 * l'assistant — un seul endroit qui sait qu'un champ vide veut dire « on ne
 * sait pas » (`undefined`, jamais 0) et qu'une saisie hors des entiers
 * positifs n'est pas ecrite : le schema la refuserait a l'enregistrement.
 */
export function AgeInput({
  age,
  onChange,
  className,
}: {
  age: number | undefined;
  onChange: (age: number | undefined) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={age ?? ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") return onChange(undefined);
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 0) onChange(n);
      }}
      placeholder="—"
      aria-label="Âge"
      className={`rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none ${className ?? ""}`}
    />
  );
}

function birthDate(year: number, month: number | null, day: number | null): GameDate {
  return { year, month, day, precision: month === null ? "year" : day === null ? "month" : "day", end: null, label: null };
}

/** Champs Prénom et Nom (V3.1-48) : le nom de l'entité est recomposé « Prénom Nom » côté serveur à l'enregistrement du bloc. */
export function NameFields({
  character,
  patchCharacter,
  className,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  className?: string;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
        Prénom
        <input
          value={character.given_name ?? ""}
          onChange={(e) => patchCharacter({ given_name: e.target.value })}
          className={`rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none ${className ?? ""}`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
        Nom
        <input
          value={character.family_name ?? ""}
          onChange={(e) => patchCharacter({ family_name: e.target.value })}
          className={`rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none ${className ?? ""}`}
        />
      </label>
    </>
  );
}

/**
 * Naissance au calendrier du monde (V3.1-48, ADR 0063) : âge, jour et mois.
 * L'âge affiché est DÉRIVÉ (`ageAt`) de la naissance et de la date du jour
 * du monde, jamais stocké (règle 16). Saisir l'âge ou le jour/mois écrit
 * `birth` (année par `birthYearFromAge`) et retire l'ancien champ `age`.
 * Sans date du jour réglée, l'âge reste « — » et l'année se saisit à la main.
 */
export function BirthFields({
  character,
  patchCharacter,
  className,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  className?: string;
}) {
  const calendar = useWorldCalendarContext();
  const today = calendar.currentDate;
  const birth = character.birth;
  // V3.1-74 : l'âge s'arrête à la mort.
  const age = birth ? ageWithDeath(birth, today, character.death) : character.age;
  const monthOptions = [
    { value: "", label: "—" },
    ...calendar.months.map((m, i) => ({ value: String(i + 1), label: m.name })),
  ];

  function writeBirth(year: number, month: number | null, day: number | null) {
    patchCharacter({ birth: birthDate(year, month, day), age: undefined });
  }

  function onAgeChange(next: number | undefined) {
    if (next === undefined) return patchCharacter({ birth: undefined, age: undefined });
    if (!today) return;
    const month = birth?.month ?? 1;
    const day = birth?.day ?? 1;
    writeBirth(birthYearFromAge(next, month, day, today), month, day);
  }

  function onMonthDayChange(month: number | null, day: number | null) {
    if (!birth) return;
    const dayKept = month === null ? null : day;
    if (today && age !== undefined) writeBirth(birthYearFromAge(age, month, dayKept, today), month, dayKept);
    else writeBirth(birth.year, month, dayKept);
  }

  const maxDay = calendar.months[(birth?.month ?? 1) - 1]?.days ?? 31;
  const bornPrefix = character.gender === "feminine" ? "Née" : character.gender === "masculine" ? "Né" : "Naissance :";
  const bornText = birth ? `${birth.precision === "day" ? "le " : "en "}${formatGameDate(birth, calendar)}` : null;
  const summary = birth
    ? [
        `${bornPrefix} ${bornText}`,
        today && age !== undefined ? `${age} an${age > 1 ? "s" : ""} au ${formatGameDate(today, calendar)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Âge
          {today ? (
            <AgeInput age={age} onChange={onAgeChange} className={className} />
          ) : (
            <input value="—" readOnly aria-label="Âge" title="L'âge attend la date du jour du monde (Calendrier)" className={`rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink-muted outline-none ${className ?? ""}`} />
          )}
        </label>
        {!today && (
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Année de naissance
            <input
              type="number"
              step={1}
              value={birth?.year ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") return patchCharacter({ birth: undefined });
                const n = Number(raw);
                if (Number.isInteger(n)) writeBirth(n, birth?.month ?? null, birth?.day ?? null);
              }}
              className={`rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none ${className ?? ""}`}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Jour
          <input
            type="number"
            min={1}
            max={maxDay}
            step={1}
            disabled={!birth || birth.month === null}
            value={birth?.day ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= maxDay) onMonthDayChange(birth?.month ?? null, n);
            }}
            aria-label="Jour de naissance"
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
          Mois
          <Dropdown
            value={birth?.month != null ? String(birth.month) : ""}
            options={monthOptions}
            onChange={(v) => onMonthDayChange(v === "" ? null : Number(v), v === "" ? null : (birth?.day ?? 1))}
            aria-label="Mois de naissance"
          />
        </label>
      </div>
      {summary && <p className="text-xs text-ink-muted">{summary}</p>}
    </div>
  );
}

function ruleRef(key: string): BlockReference | null {
  return key.trim() ? { kind: "rule", key: key.trim() } : null;
}

/**
 * Sélecteur de règle (V1-C4 suite, sur retour utilisateur) : remplace le
 * champ texte libre + suggestions par une vraie liste déroulante tirée du
 * ruleset du monde. Revirement délibéré sur une décision précédente de ce
 * même complément (qui gardait un champ libre par analogie avec §B5
 * « avertir, ne pas interdire ») — vérification faite, §B5 concerne les
 * prérequis de personnage, pas l'existence d'une clé de référence. Pour
 * espèce/historique/classe/sous-classe, la clé n'a de sens que si une fiche
 * de règle existe déjà ; un MJ qui invente une race crée d'abord sa fiche,
 * qui apparaît alors naturellement dans cette liste — pas de valeur à
 * accepter une clé qui ne résout jamais. Le bouton affiche directement le
 * nom traduit (source de la même liste que l'ancien champ), donc plus
 * besoin d'un élément séparé pour la lisibilité — juste un petit lien vers
 * la fiche de règle à côté.
 */
export function RuleSelect({
  worldSlug,
  entryTypes,
  value,
  onChange,
  emptyLabel,
  chip,
  filterFn,
  "aria-label": ariaLabel,
}: {
  worldSlug: string;
  entryTypes: readonly string[];
  value: string;
  onChange: (key: string) => void;
  emptyLabel: string;
  /**
   * Ce que cette liste choisit — « Espèce », « Classe »… Obligatoire : le
   * declencheur n'affiche que la VALEUR courante, donc sans ce nom un lecteur
   * d'ecran annonce « Humain, bouton » sans jamais dire de quoi il s'agit.
   */
  "aria-label": string;
  chip: ResolvedChipView | undefined;
  /** Filtre additionnel (V1-C4 suite) — ex. restreindre les sous-classes à celles de la classe choisie sur la même ligne. */
  filterFn?: (entry: RuleEntrySummary) => boolean;
}) {
  const { entries, chargee } = useWorldRuleEntriesEtat(worldSlug);
  const options = useMemo(() => {
    const filtered = entries
      .filter((e) => entryTypes.includes(e.entryType))
      .filter((e) => (filterFn ? filterFn(e) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ value: e.key, label: e.name }));
    return [{ value: "", label: emptyLabel }, ...filtered];
  }, [entries, entryTypes, emptyLabel, filterFn]);

  return (
    <div className="flex items-center gap-1">
      {/* Tant que la liste des regles n'est pas arrivee, la valeur n'a pas de
          nom : le menu montrerait sa cle brute (« human », « soldier »). Une
          attente neutre et inerte a la place, jamais une valeur provisoire
          (meme regle que le squelette de la fiche, V3.1-26). */}
      {chargee ? (
        <Dropdown value={value} options={options} onChange={onChange} aria-label={ariaLabel} />
      ) : (
        <Dropdown value="" options={[{ value: "", label: "…" }]} onChange={onChange} aria-label={ariaLabel} disabled />
      )}
      {chip?.found && (
        <Link
          href={chip.href}
          title={chip.summary ?? chip.name}
          className="shrink-0 text-xs no-underline transition-opacity hover:opacity-70"
          style={{ color: "var(--link-rule)" }}
        >
          ↗
        </Link>
      )}
    </div>
  );
}

/**
 * En-tête de la fiche jouable (V1-B5, extrait de `PlayableCharacterSheet.tsx`
 * par V2-G5 — pur découpage, aucun changement de comportement) : identité
 * (espèce/historique/genre/pronoms/classes), badges dérivés (CA/Initiative/
 * Vitesse/Perception/Maîtrise/Dés de vie/Épuisement), PV et XP, avertissements
 * de personnage illégal.
 */
export default function CharacterSheetHeader({
  worldSlug,
  character,
  patchCharacter,
  updateClass,
  removeClass,
  addClass,
  buildChips,
  refIdentity,
  sheet,
  busy,
  exhaustion,
  onChangeExhaustion,
  inspiration,
  onChangeInspiration,
  conditions,
  pret,
  hpCurrent,
  hpTemp,
  hpMax,
  hpLow,
  onChangeHp,
  xpCurrent,
  xpCeiling,
  xpPct,
  totalLevel,
  xpLevelThresholdsLength,
  onChangeXp,
  canLevelUp,
  onLevelUp,
  onRest,
  onExportJson,
  onRollInitiative,
  error,
  etatMourant = "vivant",
  deathSaves = { success: 0, fail: 0 },
  dernierD20 = null,
  onJetDeMort = () => {},
  concentration = null,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  updateClass: (index: number, patch: Partial<CharacterBlockData["classes"][number]>) => void;
  removeClass: (index: number) => void;
  addClass: () => void;
  buildChips: Map<string, ResolvedChipView>;
  refIdentity: (ref: BlockReference) => string;
  sheet: DerivedSheet;
  busy: boolean;
  exhaustion: number;
  onChangeExhaustion: (delta: number) => void;
  /** V2.1-26 — l'inspiration heroique, bornee a [0, 5] cote serveur. */
  inspiration: number;
  onChangeInspiration: (delta: number) => void;
  /**
   * V2.1-26 — les etats en cours (`entity_runtime_state.conditions`).
   *
   * Deja des noms LISIBLES, pas des cles : l'ecran Initiative les choisit
   * dans une liste de noms traduits (`listConditionNames`) et stocke le nom
   * tel quel. Rien a resoudre ici.
   */
  conditions: string[];
  /** V3.1-26 : la fiche calculee est prete (regles resolues + etat de jeu). Faux : squelette, aucun chiffre. */
  pret: boolean;
  hpCurrent: number;
  /** PV temporaires : entames avant les courants (V3.1-24), montres sous la jauge. */
  hpTemp: number;
  hpMax: number;
  /** PV sous un tiers du maximum : l'anneau passe en `danger`. */
  hpLow: boolean;
  /** Les trois commandes ne transmettent qu'un ECART (V3.1-26) : le serveur l'applique et le borne. */
  onChangeHp: (delta: number) => void;
  xpCurrent: number;
  xpCeiling: number;
  xpPct: number;
  totalLevel: number;
  xpLevelThresholdsLength: number;
  onChangeXp: (delta: number) => void;
  /** Seuil de PX du niveau suivant atteint (V2-G1, montee de niveau accompagnee) — voir `hasReachedNextLevel`, `src/core/rules/experience.ts`. */
  canLevelUp: boolean;
  onLevelUp: () => void;
  onRest: (kind: "short" | "long") => void;
  onExportJson: () => void;
  /** V2-M11 : jet d'initiative depuis ce badge — memes regles (fiche, permission, DD/secret) que les autres jets contextuels, jamais un second calcul cote client. */
  onRollInitiative: () => void;
  error: string | null;
  /** V3.1-32 (les cinq props suivantes sont facultatives : l'apercu de l'assistant de creation n'a pas d'etat de jeu) : « vivant » = la jauge de PV ; sinon le bloc des jets contre la mort la remplace, à toutes les largeurs. */
  etatMourant?: EtatMourant;
  deathSaves?: DeathSaves;
  /** Dernier d20 d'un jet de mort sur cette fiche (affiché à côté du bouton), `null` avant tout jet. */
  dernierD20?: number | null;
  onJetDeMort?: () => void;
  /** V3.1-32 : la concentration en cours (`runtime_state.concentration`), affichage seul — aucune action serveur ne la rompt depuis la fiche. */
  concentration?: Concentration | null;
}) {
  // Lignee (retour utilisateur : "il manque la sous-espece") — meme mecanisme
  // que classe/sous-classe cote donnees, mais `character.species` ne porte
  // qu'UNE seule cle (jamais deux champs distincts) : une lignee est un
  // `entry_type: "species"` a part entiere qui REMPLACE la cle de base
  // (`parentSpeciesKey` la relie a son espece), exactement comme
  // `SpeciesStep.tsx` (assistant de creation) le fait deja. Le menu "Espèce"
  // n'affiche donc que les especes DE BASE (`filterFn` sur `!parentSpeciesKey`)
  // et affiche toujours la cle de base meme si une lignee est choisie ; le
  // menu "Lignée" filtre par cette meme cle de base, memes deux dropdowns
  // cote a cote que classe/sous-classe.
  const regles = useWorldRuleEntries(worldSlug);
  const speciesEntries = regles.filter((e) => e.entryType === "species");
  const currentSpeciesKey = character.species?.kind === "rule" ? character.species.key : "";
  const currentSpeciesEntry = speciesEntries.find((e) => e.key === currentSpeciesKey);
  const baseSpeciesKey = currentSpeciesEntry ? (currentSpeciesEntry.parentSpeciesKey ?? currentSpeciesEntry.key) : "";
  const lineageSelected = currentSpeciesKey !== "" && currentSpeciesKey !== baseSpeciesKey;
  const baseSpeciesRefs = useMemo<BlockReference[]>(
    () => (baseSpeciesKey ? [{ kind: "rule", key: baseSpeciesKey }] : []),
    [baseSpeciesKey]
  );
  const baseSpeciesChips = useReferenceChips(worldSlug, baseSpeciesRefs);
  const baseSpeciesChip = baseSpeciesKey ? baseSpeciesChips.get(refIdentity({ kind: "rule", key: baseSpeciesKey })) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Espèce
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={baseSpeciesKey}
              onChange={(key) => patchCharacter({ species: ruleRef(key) })}
              emptyLabel="Aucune espèce"
              aria-label="Espèce"
              chip={baseSpeciesChip}
              filterFn={(entry) => !entry.parentSpeciesKey}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Lignée
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={lineageSelected ? currentSpeciesKey : ""}
              onChange={(key) =>
                patchCharacter({ species: key.trim() ? { kind: "rule", key: key.trim() } : ruleRef(baseSpeciesKey) })
              }
              emptyLabel="Aucune lignée"
              aria-label="Lignée"
              chip={lineageSelected && character.species ? buildChips.get(refIdentity(character.species)) : undefined}
              filterFn={(entry) => (baseSpeciesKey ? entry.parentSpeciesKey === baseSpeciesKey : false)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Historique
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={BACKGROUND_TYPES}
              value={character.background?.kind === "rule" ? character.background.key : ""}
              onChange={(key) => patchCharacter({ background: ruleRef(key) })}
              emptyLabel="Aucun historique"
              aria-label="Historique"
              chip={character.background ? buildChips.get(refIdentity(character.background)) : undefined}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
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
                className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            )}
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Pronoms
            <input
              value={character.pronouns ?? ""}
              onChange={(e) => patchCharacter({ pronouns: e.target.value })}
              placeholder="elle, il, iel…"
              className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
          <NameFields character={character} patchCharacter={patchCharacter} className="w-28" />
          <BirthFields character={character} patchCharacter={patchCharacter} className="w-16" />
          <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-muted">
            Classes
            <div className="flex flex-wrap items-center gap-2">
              {character.classes.map((c, index) => {
                const classKey = c.class.kind === "rule" ? c.class.key : "";
                return (
                  <div key={index} className={`flex items-center gap-1 ${index > 0 ? "border-l border-edge/50 pl-2" : ""}`}>
                    <RuleSelect
                      worldSlug={worldSlug}
                      entryTypes={CLASS_TYPES}
                      value={classKey}
                      onChange={(key) => updateClass(index, { class: { kind: "rule", key }, subclass: null })}
                      emptyLabel="Aucune classe"
                      aria-label="Classe"
                      chip={buildChips.get(refIdentity(c.class))}
                    />
                    <input
                      type="number"
                      min={1}
                      value={c.level}
                      title="Niveau"
                      onChange={(e) => updateClass(index, { level: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-9 rounded-md border border-edge bg-transparent px-1 py-1 text-sm text-ink outline-none"
                    />
                    <RuleSelect
                      worldSlug={worldSlug}
                      entryTypes={SUBCLASS_TYPES}
                      value={c.subclass?.kind === "rule" ? c.subclass.key : ""}
                      onChange={(key) => updateClass(index, { subclass: ruleRef(key) })}
                      emptyLabel="Aucune sous-classe"
                      aria-label="Sous-classe"
                      chip={c.subclass ? buildChips.get(refIdentity(c.subclass)) : undefined}
                      filterFn={(entry) => (classKey ? entry.parentClassKey === classKey : false)}
                    />
                    {character.classes.length > 1 && (
                      <button type="button" onClick={() => removeClass(index)} className="text-xs text-danger hover:underline">
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addClass}
                title="Ajouter une classe"
                className="rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => onRest("short")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos court
          </button>
          <button type="button" disabled={busy} onClick={() => onRest("long")} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel disabled:opacity-50">
            Repos long
          </button>
          <ActionsMenu
            label="Exporter"
            triggerClassName="rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel"
            aria-label="Exporter la fiche"
            items={[
              { label: "Exporter en JSON", onSelect: onExportJson },
              { label: "Exporter en PDF", onSelect: () => window.print() },
            ]}
          />
        </div>
      </div>

      {/* V3.1-26 / V3.1-34 : la rangée chiffrée vit dans `RangeeChiffree`, partagée avec l'outil Table du MJ. */}
      <RangeeChiffree
        worldSlug={worldSlug}
        sheet={sheet}
        pret={pret}
        busy={busy}
        exhaustion={exhaustion}
        onChangeExhaustion={onChangeExhaustion}
        inspiration={inspiration}
        onChangeInspiration={onChangeInspiration}
        conditions={conditions}
        hpCurrent={hpCurrent}
        hpTemp={hpTemp}
        hpMax={hpMax}
        hpLow={hpLow}
        onChangeHp={onChangeHp}
        xpCurrent={xpCurrent}
        xpCeiling={xpCeiling}
        xpPct={xpPct}
        totalLevel={totalLevel}
        xpLevelThresholdsLength={xpLevelThresholdsLength}
        onChangeXp={onChangeXp}
        onRollInitiative={onRollInitiative}
        etatMourant={etatMourant}
        deathSaves={deathSaves}
        dernierD20={dernierD20}
        onJetDeMort={onJetDeMort}
        concentration={concentration}
      />

      {pret && canLevelUp && (
        <button
          type="button"
          onClick={onLevelUp}
          className="w-full rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Monter de niveau
        </button>
      )}

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
    </>
  );
}
