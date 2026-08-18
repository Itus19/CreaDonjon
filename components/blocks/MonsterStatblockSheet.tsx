"use client";

import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import type { BlockAbility } from "@/src/core/schemas/blocks/abilities";
import { SKILLS, type Skill } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import Dropdown from "@/components/shared/Dropdown";

const ABILITY_LABELS: Record<BlockAbility, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};
const ABILITIES = Object.keys(ABILITY_LABELS) as BlockAbility[];
const SORTED_SKILLS = [...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b]));

type EntryListKey = "traits" | "actions" | "reactions" | "legendary_actions";
const ENTRY_LIST_LABELS: Record<EntryListKey, string> = {
  traits: "Traits",
  actions: "Actions",
  reactions: "Réactions",
  legendary_actions: "Actions légendaires",
};

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(mod: number): string {
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

function skillLabel(skill: string): string {
  return SKILL_LABELS_FR[skill as Skill] ?? skill;
}

function StatBadgeText({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span className="flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest text-ink-muted">
        {label}
      </span>
      <div className="flex h-14 w-full items-center justify-center rounded-md border border-edge bg-panel-raised px-1">
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-center text-sm font-semibold text-ink outline-none"
        />
      </div>
    </div>
  );
}

function StatBadgeNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span className="flex h-6 items-end justify-center text-center text-[9px] font-bold uppercase leading-tight tracking-widest text-ink-muted">
        {label}
      </span>
      <div className="flex h-14 w-full items-center justify-center rounded-md border border-edge bg-panel-raised px-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent text-center text-base font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

type Entry = { name: string; text: string };

function FeatureList({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{title}</span>
      {entries.length === 0 && <p className="text-sm italic text-ink-muted">Aucune entrée.</p>}
      {entries.map((entry, index) => (
        <div key={index} className="rounded-md border border-edge/60 bg-panel-raised p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <input
              value={entry.name}
              onChange={(e) => onChange(entries.map((en, i) => (i === index ? { ...en, name: e.target.value } : en)))}
              placeholder="Nom"
              className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              className="shrink-0 text-xs text-danger hover:underline"
            >
              ×
            </button>
          </div>
          <textarea
            value={entry.text}
            onChange={(e) => onChange(entries.map((en, i) => (i === index ? { ...en, text: e.target.value } : en)))}
            rows={2}
            className="mt-1 w-full resize-y bg-transparent text-sm leading-relaxed text-ink outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...entries, { name: "", text: "" }])}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter
      </button>
    </div>
  );
}

/**
 * Fiche de créature (V1-E4 suite, retour utilisateur) : même architecture
 * visuelle que `PlayableCharacterSheet` (V1-B5) — caractéristiques en
 * boîtes, CA en écusson, compétences en liste — mais réduite à ce qu'une
 * créature sans build possède réellement : pas d'espèce/historique/classe
 * (`statblock` porte des valeurs plates, jamais dérivées), compétences
 * limitées à celles effectivement connues plutôt que les dix-huit, et
 * Traits/Actions/Réactions/Actions légendaires toutes visibles ensemble —
 * jamais derrière des onglets, contrairement à la fiche jouable (demande
 * explicite : « visible en une fois »). Toujours affichée, jamais repliée
 * (EntityBlocks la traite comme le bloc `character`), pour rester visible
 * quand on déroule les détails d'une entité.
 *
 * Champs controlés (value/onChange sur chaque frappe), jamais
 * defaultValue/onBlur : un onBlur qui se déclenche dans le même lot que le
 * clic d'un bouton voisin (React 18 regroupe les deux) capture `data` avant
 * la mise à jour de l'autre champ et l'écrase — perte de saisie constatée
 * en test manuel sur le nom/texte d'un trait au clic sur un bouton de
 * sauvegarde voisin. Même motif que `PlayableCharacterSheet`, qui n'a
 * jamais cette course precisement parce qu'il commit a chaque frappe.
 */
export default function MonsterStatblockSheet({
  data,
  onChange,
}: {
  data: StatblockBlockData;
  onChange: (data: StatblockBlockData) => void;
}) {
  function patch(fields: Partial<StatblockBlockData>) {
    onChange({ ...data, ...fields });
  }

  const savingThrows = data.saving_throws ?? {};
  const skills = data.skills ?? {};
  const remainingSkills = SORTED_SKILLS.filter((s) => !(s in skills));
  const sortedSkillKeys = Object.keys(skills).sort((a, b) => skillLabel(a).localeCompare(skillLabel(b)));

  function toggleSave(ability: BlockAbility) {
    if (ability in savingThrows) {
      const next = { ...savingThrows };
      delete next[ability];
      patch({ saving_throws: next });
    } else {
      patch({ saving_throws: { ...savingThrows, [ability]: abilityMod(data.abilities[ability]) } });
    }
  }

  function addSkill(skill: string) {
    if (!skill || skill in skills) return;
    patch({ skills: { ...skills, [skill]: 0 } });
  }

  function removeSkill(skill: string) {
    const next = { ...skills };
    delete next[skill];
    patch({ skills: next });
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Taille
          <input
            value={data.size}
            onChange={(e) => patch({ size: e.target.value })}
            className="w-28 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Type
          <input
            value={data.creature_type}
            onChange={(e) => patch({ creature_type: e.target.value })}
            className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Alignement
          <input
            value={data.alignment ?? ""}
            onChange={(e) => patch({ alignment: e.target.value || undefined })}
            className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
          Source CA
          <input
            value={data.ac.source ?? ""}
            placeholder="armure naturelle"
            onChange={(e) => patch({ ac: { ...data.ac, source: e.target.value || undefined } })}
            className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
          >
            <input
              type="number"
              value={data.ac.value}
              onChange={(e) => patch({ ac: { ...data.ac, value: Number(e.target.value) || 0 } })}
              className="w-9 bg-transparent text-center text-xl font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
        <StatBadgeNumber label="PV" value={data.hp.value} onChange={(v) => patch({ hp: { ...data.hp, value: v } })} />
        <StatBadgeText
          label="Dés de vie"
          value={data.hp.hit_dice ?? ""}
          placeholder="2d6"
          onChange={(v) => patch({ hp: { ...data.hp, hit_dice: v || undefined } })}
        />
        <StatBadgeText label="Vitesse" value={data.speed} onChange={(v) => patch({ speed: v })} />
        <StatBadgeText
          label="FP"
          value={data.challenge_rating ?? ""}
          placeholder="1/4"
          onChange={(v) => patch({ challenge_rating: v || undefined })}
        />
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <aside className="flex flex-col gap-3 md:w-48 md:shrink-0">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Caractéristiques</span>
            <div className="grid grid-cols-2 gap-2">
              {ABILITIES.map((ability) => {
                const hasSave = ability in savingThrows;
                return (
                  <div
                    key={ability}
                    className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
                    <span className="text-xl font-bold text-ink">{fmtMod(abilityMod(data.abilities[ability]))}</span>
                    <input
                      type="number"
                      value={data.abilities[ability]}
                      onChange={(e) => patch({ abilities: { ...data.abilities, [ability]: Number(e.target.value) || 0 } })}
                      className="w-10 rounded-full border border-edge bg-panel-sunken px-1 py-0.5 text-center text-xs text-ink-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSave(ability)}
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        hasSave ? "border-accent bg-accent/20 text-accent" : "border-edge text-ink-muted"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${hasSave ? "bg-accent" : "bg-edge"}`} aria-hidden="true" />
                      Sauv. {hasSave ? fmtMod(savingThrows[ability] ?? 0) : "—"}
                    </button>
                    {hasSave && (
                      <input
                        type="number"
                        value={savingThrows[ability]}
                        onChange={(e) => patch({ saving_throws: { ...savingThrows, [ability]: Number(e.target.value) || 0 } })}
                        className="w-10 rounded-full border border-edge bg-panel-sunken px-1 py-0.5 text-center text-xs text-ink-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Compétences</span>
            <div className="flex flex-col gap-1">
              {sortedSkillKeys.length === 0 && <p className="text-sm italic text-ink-muted">Aucune.</p>}
              {sortedSkillKeys.map((skill) => (
                <div key={skill} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-ink">{skillLabel(skill)}</span>
                  <input
                    type="number"
                    value={skills[skill]}
                    onChange={(e) => patch({ skills: { ...skills, [skill]: Number(e.target.value) || 0 } })}
                    className="w-10 rounded-md border border-edge bg-transparent px-1 py-0.5 text-center text-xs text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button type="button" onClick={() => removeSkill(skill)} className="text-xs text-danger hover:underline">
                    ×
                  </button>
                </div>
              ))}
            </div>
            {remainingSkills.length > 0 && (
              <Dropdown
                value=""
                onChange={(s) => addSkill(s)}
                options={[{ value: "", label: "+ Compétence" }, ...remainingSkills.map((s) => ({ value: s, label: skillLabel(s) }))]}
                aria-label="Ajouter une compétence"
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
              Sens
              <input
                value={data.senses ?? ""}
                onChange={(e) => patch({ senses: e.target.value || undefined })}
                className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
              Langues
              <input
                value={data.languages ?? ""}
                onChange={(e) => patch({ languages: e.target.value || undefined })}
                className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
              />
            </label>
          </div>
        </aside>

        <div className="flex flex-1 flex-col gap-4">
          {(Object.keys(ENTRY_LIST_LABELS) as EntryListKey[]).map((key) => (
            <FeatureList
              key={key}
              title={ENTRY_LIST_LABELS[key]}
              entries={data[key]}
              onChange={(entries) => patch({ [key]: entries })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
