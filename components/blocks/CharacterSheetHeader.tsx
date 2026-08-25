"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import { ftToM } from "@/src/core/rules/encumbrance";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { useReferenceChips, type ResolvedChipView } from "./useReferenceChips";
import Dropdown from "@/components/shared/Dropdown";
import ActionsMenu from "@/components/shared/ActionsMenu";

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
}: {
  worldSlug: string;
  entryTypes: readonly string[];
  value: string;
  onChange: (key: string) => void;
  emptyLabel: string;
  chip: ResolvedChipView | undefined;
  /** Filtre additionnel (V1-C4 suite) — ex. restreindre les sous-classes à celles de la classe choisie sur la même ligne. */
  filterFn?: (entry: RuleEntrySummary) => boolean;
}) {
  const entries = useWorldRuleEntries(worldSlug);
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
      <Dropdown value={value} options={options} onChange={onChange} />
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
export function StatBadge({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span
        className={`flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest ${
          danger ? "text-danger" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      <div
        className={`flex h-14 w-full items-center justify-center rounded-md border ${
          danger ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
        }`}
      >
        <span className={`text-base font-semibold ${danger ? "text-danger" : "text-ink"}`}>{value}</span>
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
  hpCurrent,
  hpMax,
  hpLow,
  hpPct,
  hpDelta,
  setHpDelta,
  applyHpDelta,
  xpCurrent,
  xpCeiling,
  xpPct,
  totalLevel,
  xpLevelThresholdsLength,
  xpDelta,
  setXpDelta,
  applyXpDelta,
  onRest,
  onExportJson,
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
  hpCurrent: number;
  hpMax: number;
  hpLow: boolean;
  hpPct: number;
  hpDelta: string;
  setHpDelta: (v: string) => void;
  applyHpDelta: (sign: 1 | -1) => void;
  xpCurrent: number;
  xpCeiling: number;
  xpPct: number;
  totalLevel: number;
  xpLevelThresholdsLength: number;
  xpDelta: string;
  setXpDelta: (v: string) => void;
  applyXpDelta: (sign: 1 | -1) => void;
  onRest: (kind: "short" | "long") => void;
  onExportJson: () => void;
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

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Espèce
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={baseSpeciesKey}
              onChange={(key) => patchCharacter({ species: ruleRef(key) })}
              emptyLabel="Aucune espèce"
              chip={baseSpeciesChip}
              filterFn={(entry) => !entry.parentSpeciesKey}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Lignée
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={SPECIES_TYPES}
              value={lineageSelected ? currentSpeciesKey : ""}
              onChange={(key) =>
                patchCharacter({ species: key.trim() ? { kind: "rule", key: key.trim() } : ruleRef(baseSpeciesKey) })
              }
              emptyLabel="Aucune lignée"
              chip={lineageSelected && character.species ? buildChips.get(refIdentity(character.species)) : undefined}
              filterFn={(entry) => (baseSpeciesKey ? entry.parentSpeciesKey === baseSpeciesKey : false)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Historique
            <RuleSelect
              worldSlug={worldSlug}
              entryTypes={BACKGROUND_TYPES}
              value={character.background?.kind === "rule" ? character.background.key : ""}
              onChange={(key) => patchCharacter({ background: ruleRef(key) })}
              emptyLabel="Aucun historique"
              chip={character.background ? buildChips.get(refIdentity(character.background)) : undefined}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
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
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
            Pronoms
            <input
              value={character.pronouns ?? ""}
              onChange={(e) => patchCharacter({ pronouns: e.target.value })}
              placeholder="elle, il, iel…"
              className="w-24 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
          <div className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
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

      <div className="flex flex-wrap items-start gap-2">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
            title="Classe d'armure — calculée automatiquement (10 + Dex + équipement)"
          >
            <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>
          </div>
        </div>
        <StatBadge label="Initiative" value={`${sheet.abilities.dex.mod >= 0 ? "+" : ""}${sheet.abilities.dex.mod}`} />
        <StatBadge label="Vitesse" value={`${ftToM(sheet.speed.value)} m`} />
        <StatBadge label="Perception passive" value={String(10 + sheet.skills.perception.mod)} />
        <StatBadge label="Maîtrise" value={`+${sheet.proficiencyBonus}`} />
        <StatBadge label="Dés de vie" value={sheet.hitPoints.hitDice} />
        <div className="flex w-[6.5rem] shrink-0 flex-col items-center gap-1">
          <span
            className={`flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest ${
              exhaustion > 0 ? "text-danger" : "text-ink-muted"
            }`}
          >
            Épuisement
          </span>
          <div
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-full border px-1.5 ${
              exhaustion > 0 ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
            }`}
          >
            <button
              type="button"
              disabled={busy || exhaustion <= 0}
              onClick={() => onChangeExhaustion(-1)}
              className="rounded-full border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-30"
            >
              −
            </button>
            <span className={`text-base font-semibold ${exhaustion > 0 ? "text-danger" : "text-ink"}`}>{exhaustion}</span>
            <button
              type="button"
              disabled={busy || exhaustion >= 6}
              onClick={() => onChangeExhaustion(1)}
              className="rounded-full border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          <span>Points de vie</span>
          <span className={hpLow ? "text-danger" : "text-ink-muted"}>
            {hpCurrent}/{hpMax}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
            <div className={`h-full rounded-full transition-[width] ${hpLow ? "bg-danger" : "bg-accent"}`} style={{ width: `${hpPct}%` }} />
          </div>
          <input
            type="number"
            value={hpDelta}
            onChange={(e) => setHpDelta(e.target.value)}
            placeholder="1"
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
          <button type="button" disabled={busy} onClick={() => applyHpDelta(-1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            −
          </button>
          <button type="button" disabled={busy} onClick={() => applyHpDelta(1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-b border-edge/60 pb-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          <span>Expérience</span>
          <span>
            {xpCurrent} XP{totalLevel < xpLevelThresholdsLength ? ` · niveau ${totalLevel + 1} à ${xpCeiling}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${xpPct}%` }} />
          </div>
          <input
            type="number"
            value={xpDelta}
            onChange={(e) => setXpDelta(e.target.value)}
            placeholder="1"
            className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
          <button type="button" disabled={busy} onClick={() => applyXpDelta(-1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            −
          </button>
          <button type="button" disabled={busy} onClick={() => applyXpDelta(1)} className="rounded border border-edge px-2 py-0.5 text-sm hover:bg-panel disabled:opacity-50">
            +
          </button>
        </div>
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
    </>
  );
}
