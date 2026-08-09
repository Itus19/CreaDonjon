"use client";

import { useMemo, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import ReferenceChipDisplay from "./ReferenceChipDisplay";
import RuleEntryAutocomplete from "./RuleEntryAutocomplete";

const SPECIES_TYPES = ["species"] as const;
const BACKGROUND_TYPES = ["background"] as const;
const CLASS_TYPES = ["class"] as const;
const SUBCLASS_TYPES = ["subclass"] as const;

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<(typeof ABILITIES)[number], string> = {
  str: "Force",
  dex: "Dexterite",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme",
};

function ruleRef(key: string): BlockReference | null {
  return key.trim() ? { kind: "rule", key: key.trim() } : null;
}

const GENDER_OPTIONS = [
  { value: "unspecified", label: "Non précisé" },
  { value: "feminine", label: "Féminin" },
  { value: "masculine", label: "Masculin" },
  { value: "neutral", label: "Neutre" },
  { value: "custom", label: "Personnalisé" },
];

/** `unspecified` (on ne sait pas) et `neutral` (ni l'un ni l'autre) restent deux valeurs distinctes du menu — jamais fusionnees (V1-C4). */
function genderDropdownValue(gender: CharacterBlockData["gender"]): string {
  if (!gender) return "unspecified";
  if (typeof gender === "object") return "custom";
  return gender;
}

/**
 * Bloc `character` (V1-B2) : le build seul (specs/wiki-liens-et-personnages.md
 * §B1) — aucune valeur derivee editable ici, la fiche de jeu se recalcule
 * ailleurs via characterSheet(). Espece/historique/classes/sous-classe
 * restent des cles de regle en texte libre (§B5 "avertir, ne pas
 * interdire" — une cle inconnue n'est jamais bloquee), mais
 * `RuleEntryAutocomplete` propose les entrees du ruleset pendant la frappe ;
 * leur `<RuleChip>` confirme immediatement si la cle retenue existe.
 */
export default function CharacterBlockEditor({
  data,
  onChange,
  worldSlug,
}: {
  data: CharacterBlockData;
  onChange: (data: CharacterBlockData) => void;
  worldSlug: string;
}) {
  const [choicesText, setChoicesText] = useState(() => JSON.stringify(data.choices, null, 2));
  const [choicesError, setChoicesError] = useState<string | null>(null);

  const refsToResolve = useMemo(() => {
    const refs: BlockReference[] = [];
    if (data.species) refs.push(data.species);
    if (data.background) refs.push(data.background);
    for (const c of data.classes) {
      refs.push(c.class);
      if (c.subclass) refs.push(c.subclass);
    }
    return refs;
  }, [data.species, data.background, data.classes]);
  const chips = useReferenceChips(worldSlug, refsToResolve);

  function patch(fields: Partial<CharacterBlockData>) {
    onChange({ ...data, ...fields });
  }

  function updateClass(index: number, patchFields: Partial<CharacterBlockData["classes"][number]>) {
    patch({ classes: data.classes.map((c, i) => (i === index ? { ...c, ...patchFields } : c)) });
  }

  function removeClass(index: number) {
    patch({ classes: data.classes.filter((_, i) => i !== index) });
  }

  function addClass() {
    patch({ classes: [...data.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

  function commitChoices() {
    try {
      const parsed = JSON.parse(choicesText || "{}");
      setChoicesError(null);
      patch({ choices: parsed });
    } catch {
      setChoicesError("JSON invalide — modification ignoree.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Espece (cle de regle)
          <RuleEntryAutocomplete
            worldSlug={worldSlug}
            entryTypes={SPECIES_TYPES}
            value={data.species?.kind === "rule" ? data.species.key : ""}
            onChange={(key) => patch({ species: ruleRef(key) })}
            placeholder="dwarf"
          />
          {data.species && <ReferenceChipDisplay reference={data.species} chip={chips.get(refIdentity(data.species))} />}
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Historique (cle de regle)
          <RuleEntryAutocomplete
            worldSlug={worldSlug}
            entryTypes={BACKGROUND_TYPES}
            value={data.background?.kind === "rule" ? data.background.key : ""}
            onChange={(key) => patch({ background: ruleRef(key) })}
            placeholder="soldier"
          />
          {data.background && (
            <ReferenceChipDisplay reference={data.background} chip={chips.get(refIdentity(data.background))} />
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Genre
          <Dropdown
            value={genderDropdownValue(data.gender)}
            options={GENDER_OPTIONS}
            onChange={(v) =>
              patch({
                gender:
                  v === "custom"
                    ? { custom: typeof data.gender === "object" ? data.gender.custom : "" }
                    : (v as Exclude<CharacterBlockData["gender"], { custom: string } | undefined>),
              })
            }
            aria-label="Genre"
          />
          {typeof data.gender === "object" && (
            <input
              value={data.gender.custom}
              onChange={(e) => patch({ gender: { custom: e.target.value } })}
              placeholder="préciser…"
              className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Pronoms
          <input
            value={data.pronouns ?? ""}
            onChange={(e) => patch({ pronouns: e.target.value })}
            placeholder="elle, il, iel…"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Classes</span>
        {data.classes.map((c, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
            <div className="w-28">
              <RuleEntryAutocomplete
                worldSlug={worldSlug}
                entryTypes={CLASS_TYPES}
                value={c.class.kind === "rule" ? c.class.key : ""}
                onChange={(key) => updateClass(index, { class: { kind: "rule", key } })}
                placeholder="fighter"
              />
            </div>
            <input
              type="number"
              min={1}
              value={c.level}
              onChange={(e) => updateClass(index, { level: Math.max(1, Number(e.target.value) || 1) })}
              className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <div className="flex-1">
              <RuleEntryAutocomplete
                worldSlug={worldSlug}
                entryTypes={SUBCLASS_TYPES}
                value={c.subclass?.kind === "rule" ? c.subclass.key : ""}
                onChange={(key) => updateClass(index, { subclass: ruleRef(key) })}
                placeholder="sous-classe (optionnel)"
              />
            </div>
            <ReferenceChipDisplay reference={c.class} chip={chips.get(refIdentity(c.class))} />
            <button type="button" onClick={() => removeClass(index)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addClass}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter une classe
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caracteristiques attribuees</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Methode</span>
          <Dropdown
            value={data.abilities.method}
            options={[
              { value: "standard_array", label: "Tableau standard" },
              { value: "point_buy", label: "Achat de points" },
              { value: "roll", label: "Tirage" },
            ]}
            onChange={(v) => patch({ abilities: { ...data.abilities, method: v as CharacterBlockData["abilities"]["method"] } })}
            aria-label="Methode d'attribution"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITIES.map((ability) => (
            <label key={ability} className="flex flex-col gap-1 text-xs text-ink-muted">
              {ABILITY_LABELS[ability]}
              <input
                type="number"
                value={data.abilities.base[ability]}
                onChange={(e) =>
                  patch({
                    abilities: {
                      ...data.abilities,
                      base: { ...data.abilities.base, [ability]: Number(e.target.value) || 0 },
                    },
                  })
                }
                className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">Points de vie</span>
        <Dropdown
          value={data.hp_method}
          options={[
            { value: "fixed", label: "Valeur fixe" },
            { value: "rolled", label: "Jetes" },
          ]}
          onChange={(v) => patch({ hp_method: v as CharacterBlockData["hp_method"] })}
          aria-label="Methode de points de vie"
        />
      </div>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Choix (JSON, cles qualifiees par origine — ex. &quot;fighter.l1.c1&quot;)
        <textarea
          value={choicesText}
          onChange={(e) => setChoicesText(e.target.value)}
          onBlur={commitChoices}
          rows={4}
          className="rounded-md border border-edge bg-transparent px-2 py-1 font-mono text-xs text-ink outline-none"
        />
        {choicesError && <span className="text-danger">{choicesError}</span>}
      </label>
    </div>
  );
}
