"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { ftToM } from "@/src/core/rules/encumbrance";
import { squaresFromMeters } from "@/src/core/rules/gridSquares";
import { useWorldRuleEntries, useWorldRuleEntriesEtat } from "./useWorldRuleEntries";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useReferenceChips, type ResolvedChipView } from "./useReferenceChips";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";
import CommandeE, { CommandeESquelette } from "@/components/shared/CommandeE";
import { useWorldCalendarContext } from "@/components/shared/WorldCalendarProvider";
import { birthYearFromAge } from "@/src/core/calendar/age";
import { ageWithDeath } from "@/src/core/genealogy/lifeDates";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { GameDate } from "@/src/core/calendar/types";

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
 * Badge de statistique (V1-C4 suite) : la charte interdit les couleurs
 * codées en dur (specs/coquille-et-design.md §2), donc CA/Initiative/
 * Vitesse/etc. se distinguent par forme et libellé plutôt que par une
 * couleur inventée par stat. Libellé au-dessus d'un encadré de hauteur fixe
 * (meme structure que le bouclier de CA, meme hauteur `h-14`) — sur retour
 * utilisateur, l'ancien libellé-dans-l'encadré donnait des hauteurs
 * variables selon que le libellé tenait sur une ou deux lignes.
 */
/** `onClick` (V2-M11) : seule l'Initiative s'en sert aujourd'hui — un jet declenche depuis le volet de lancer de des, jamais un second calcul ici. */
export function StatBadge({
  label,
  value,
  sub,
  danger,
  chargement,
  onClick,
}: {
  label: string;
  value: string;
  /** Seconde ligne, plus discrete, sous la valeur : une meme mesure dans une autre unite (la vitesse en cases de plateau), jamais une donnee sans rapport. */
  sub?: string;
  danger?: boolean;
  /** V3.1-26 : la fiche calculee n'est pas prete — case creuse, SANS chiffre (jamais la valeur provisoire). */
  chargement?: boolean;
  onClick?: () => void;
}) {
  if (chargement) {
    return (
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1" aria-hidden="true">
        <span className="flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide text-ink-muted">{label}</span>
        <div className="h-14 w-full animate-pulse rounded-md border border-edge bg-panel-sunken" />
      </div>
    );
  }
  const box = (
    <div
      className={`flex h-14 w-full flex-col items-center justify-center rounded-md border ${
        danger ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
      } ${onClick ? "cursor-pointer hover:border-accent" : ""}`}
    >
      <span className={`text-base font-semibold leading-tight ${danger ? "text-danger" : "text-ink"}`}>{value}</span>
      {sub && <span className="text-xs leading-tight text-ink-muted">{sub}</span>}
    </div>
  );
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span
        className={`flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide ${
          danger ? "text-danger" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} title={`Lancer ${label}`} className="w-full">
          {box}
        </button>
      ) : (
        box
      )}
    </div>
  );
}

/**
 * Inspiration (V3.1-26) : exactement le gabarit d'un `StatBadge` (72 x 56 px,
 * meme chiffre `text-base`), avec ▲ et ▼ INTEGRES au badge. Accentuee quand on en
 * a (un bien, la ou l'epuisement passe en `danger`). Ne transmet qu'un ecart.
 * Les fleches font 16 px de haut ; leur zone de clic descend a 24 px vers le
 * centre (le badge est `overflow-hidden`, une extension vers l'exterieur serait rognee).
 */
function InspirationBadge({
  valeur,
  chargement,
  desactive,
  onChange,
}: {
  valeur: number;
  chargement: boolean;
  desactive: boolean;
  onChange: (delta: number) => void;
}) {
  if (chargement) return <StatBadge label="Inspiration" value="" chargement />;
  const actif = valeur > 0;
  const fleche =
    "relative flex h-4 w-full shrink-0 items-center justify-center text-xs leading-none text-ink-muted transition-colors after:absolute after:inset-x-0 after:h-6 after:content-[''] hover:text-accent disabled:opacity-30 disabled:hover:text-ink-muted";
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span className={`flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide ${actif ? "text-accent" : "text-ink-muted"}`}>
        Inspiration
      </span>
      <div className={`flex h-14 w-full flex-col overflow-hidden rounded-md border ${actif ? "border-accent/60 bg-accent/10" : "border-edge bg-panel-raised"}`}>
        <button
          type="button"
          disabled={desactive}
          onClick={() => onChange(1)}
          title="Ajouter une inspiration"
          aria-label="Ajouter une inspiration"
          className={`${fleche} after:top-0`}
        >
          ▲
        </button>
        <span className={`flex flex-1 items-center justify-center text-base font-semibold leading-none ${actif ? "text-accent" : "text-ink"}`}>{valeur}</span>
        <button
          type="button"
          disabled={desactive || valeur <= 0}
          onClick={() => onChange(-1)}
          title="Retirer une inspiration"
          aria-label="Retirer une inspiration"
          className={`${fleche} after:bottom-0`}
        >
          ▼
        </button>
      </div>
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
  const speciesEntries = useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "species");
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

  // Cases comptees depuis les METRES affiches, pas depuis les pieds d'origine :
  // les deux lignes de la case Vitesse doivent pouvoir se verifier l'une par
  // l'autre. Metres arrondis AU METRE (30 pieds -> 9 m, V3.1-26) ; le compte
  // en cases reste celui du SRD pour toute vitesse par pas de 5 pieds de 5 a 100
  // (verifie a la main, voir `gridSquares.test.ts` pour les vitesses standard).
  const speedMeters = Math.round(ftToM(sheet.speed.value));
  const speedSquares = squaresFromMeters(speedMeters);

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

      {/*
        V3.1-26 — la rangée chiffrée de la fiche d'ordinateur : bouclier de CA,
        trois jauges à commande E (PV, niveau/XP, épuisement), un filet, puis les
        constantes en badges (Inspiration au même gabarit qu'un badge).

        Tant que `pret` est faux (règles résolues ou état de jeu pas encore
        arrivés), AUCUN chiffre : un squelette de même encombrement. Les valeurs
        de départ d'avant (CA 11, PV 0/0) étaient fausses, et la CA provisoire
        différait entre le rendu serveur et le navigateur (erreur d'hydratation).
      */}
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-8 items-end justify-center text-xs font-bold uppercase tracking-wide text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
            title="Classe d'armure — calculée automatiquement (10 + Dex + équipement)"
          >
            {pret && <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>}
          </div>
        </div>

        {pret ? (
          <>
            <CommandeE
              libelle="Points de vie"
              valeur={hpCurrent}
              maximum={hpMax}
              danger={hpLow}
              complement={hpTemp > 0 ? `+${hpTemp} temp.` : undefined}
              desactive={busy}
              onDelta={onChangeHp}
            />
            <CommandeE
              libelle={`Niveau ${totalLevel}`}
              valeur={xpCurrent}
              progression={xpPct}
              complement={totalLevel < xpLevelThresholdsLength ? `niveau ${totalLevel + 1} à ${xpCeiling}` : undefined}
              desactive={busy}
              onDelta={onChangeXp}
            />
            <CommandeE libelle="Épuisement" valeur={exhaustion} maximum={6} danger={exhaustion > 0} desactive={busy} onDelta={onChangeExhaustion} />
          </>
        ) : (
          <>
            <CommandeESquelette libelle="Points de vie" />
            <CommandeESquelette libelle="Niveau" />
            <CommandeESquelette libelle="Épuisement" />
          </>
        )}

        <div className="hidden h-14 w-px self-end bg-edge/60 @min-[40rem]:block" aria-hidden="true" />

        <div className="flex flex-wrap items-start gap-2">
          <StatBadge
            label="Initiative"
            value={`${sheet.abilities.dex.mod >= 0 ? "+" : ""}${sheet.abilities.dex.mod}`}
            chargement={!pret}
            onClick={onRollInitiative}
          />
          {/* Vitesse en cases du plateau sous les mètres (retour utilisateur) :
              la même mesure dans l'unité réellement utilisée à la table. Mètres
              arrondis au mètre (« 9 m », pas « 9.1 m »), cases comptées depuis ces
              mètres : à la case inférieure, on ne franchit pas une case à moitié. */}
          <StatBadge
            label="Vitesse"
            value={`${speedMeters} m`}
            sub={`${speedSquares} case${speedSquares > 1 ? "s" : ""}`}
            chargement={!pret}
          />
          <StatBadge label="Perception passive" value={String(10 + sheet.skills.perception.mod)} chargement={!pret} />
          <StatBadge label="Maîtrise" value={`+${sheet.proficiencyBonus}`} chargement={!pret} />
          <StatBadge label="Dés de vie" value={sheet.hitPoints.hitDice} chargement={!pret} />
          <InspirationBadge
            valeur={inspiration}
            chargement={!pret}
            desactive={busy}
            onChange={onChangeInspiration}
          />
        </div>
      </div>

      {/* V2.1-26 — les états en cours. Ils étaient déjà en base, écrits par
          l'écran Initiative, et la fiche ne les montrait nulle part : le MJ
          posait un état, le joueur ne le voyait pas. */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">États</span>
          {conditions.map((condition) => (
            <span key={condition} className="rounded-full border border-danger px-3 py-1 text-xs text-danger">
              {condition}
            </span>
          ))}
        </div>
      )}

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
