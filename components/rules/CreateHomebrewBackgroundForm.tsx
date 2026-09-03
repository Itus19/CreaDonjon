"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ABILITIES, ABILITY_LABELS, SKILLS, type Ability, type Skill } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import RuleEntryAutocomplete from "@/components/blocks/RuleEntryAutocomplete";
import DescriptionTextarea from "@/components/rules/DescriptionTextarea";
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import { useOpenRuleToolLink } from "@/components/shell/useOpenRuleToolLink";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
}

interface EquipmentItemDraft {
  key: string;
  quantity: number;
}

interface EquipmentOptionDraft {
  label: string;
  items: EquipmentItemDraft[];
  gold: string;
}

const EQUIPMENT_ENTRY_TYPES = ["item", "weapon", "magic_item", "mount"] as const;
const FEAT_ENTRY_TYPES = ["feature"] as const;

function nextOptionLabel(count: number): string {
  return String.fromCharCode(65 + count);
}

/**
 * Contrairement a `CreateHomebrewWeaponForm.tsx`, aucune assistance IA ici : le contenu de manuel ne se saisit jamais automatiquement (CLAUDE.md).
 *
 * Objets et don accorde passent par `RuleEntryAutocomplete` — une vraie
 * fiche existante, jamais un texte recopie a la main (retour utilisateur :
 * "il faudrait une connexion avec les regles d'objet... aille chercher la
 * liste des dons existants"). Le don n'existe pas encore ? Il se cree
 * d'abord via `CreateHomebrewFeatureForm.tsx` ("Ajouter une regle > Don /
 * Aptitude") — ce formulaire ne cree plus lui-meme une entree compagnon a
 * la volee comme sa premiere version.
 */
export default function CreateHomebrewBackgroundForm({
  worldSlug,
  onDone,
}: {
  worldSlug: string;
  /** Ouvert en fenetre flottante (retour utilisateur, V2) : ferme la fenetre au lieu de naviguer vers la fiche creee — jamais fourni depuis la route en plein cadre, qui garde la navigation habituelle. */
  onDone?: () => void;
}) {
  const t = useTranslations("regles");
  const router = useRouter();
  const worldEntries = useWorldRuleEntries(worldSlug);
  const openDonLink = useOpenRuleToolLink(worldSlug, "nouveau-don");

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [abilityScores, setAbilityScores] = useState<Ability[]>(["str", "dex", "con"]);
  const [skillProficiencies, setSkillProficiencies] = useState<Set<Skill>>(new Set());
  const [toolProficiency, setToolProficiency] = useState("");
  const [featKey, setFeatKey] = useState("");
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionDraft[]>([
    { label: "A", items: [{ key: "", quantity: 1 }], gold: "" },
    { label: "B", items: [], gold: "50" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/ruleset`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { options: SelectableRuleset[]; current: string | null }) => {
        setCurrentRuleset(body.options.find((o) => o.id === body.current) ?? null);
      })
      .catch(() => setError(t("erreurChargementRulesets")))
      .finally(() => setLoading(false));
  }, [worldSlug, t]);

  const featEntry = worldEntries.find((e) => e.entryType === "feature" && e.key === featKey);

  function setAbilityAt(index: number, value: Ability) {
    setAbilityScores((prev) => prev.map((a, i) => (i === index ? value : a)));
  }

  function toggleSkill(skill: Skill) {
    setSkillProficiencies((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  function updateOption(index: number, updates: Partial<EquipmentOptionDraft>) {
    setEquipmentOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...updates } : o)));
  }

  function addOption() {
    setEquipmentOptions((prev) => [...prev, { label: nextOptionLabel(prev.length), items: [], gold: "" }]);
  }

  function removeOption(index: number) {
    setEquipmentOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(optionIndex: number, itemIndex: number, updates: Partial<EquipmentItemDraft>) {
    setEquipmentOptions((prev) =>
      prev.map((o, i) =>
        i !== optionIndex ? o : { ...o, items: o.items.map((it, j) => (j === itemIndex ? { ...it, ...updates } : it)) }
      )
    );
  }

  function addItem(optionIndex: number) {
    setEquipmentOptions((prev) => prev.map((o, i) => (i === optionIndex ? { ...o, items: [...o.items, { key: "", quantity: 1 }] } : o)));
  }

  function removeItem(optionIndex: number, itemIndex: number) {
    setEquipmentOptions((prev) =>
      prev.map((o, i) => (i !== optionIndex ? o : { ...o, items: o.items.filter((_, j) => j !== itemIndex) }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim()) return;
    if (!featEntry) {
      setError(t("erreurDonInconnu"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const equipment_options = equipmentOptions.map((o) => ({
      label: o.label,
      items: o.items
        .filter((it) => it.key.trim() !== "")
        .map((it) => {
          const matched = worldEntries.find((e) => EQUIPMENT_ENTRY_TYPES.includes(e.entryType as (typeof EQUIPMENT_ENTRY_TYPES)[number]) && e.key === it.key);
          return matched
            ? { ref: { kind: "rule", key: matched.key }, label: matched.name, quantity: it.quantity }
            : { label: it.key.trim(), quantity: it.quantity };
        }),
      gold: o.gold.trim() ? { value: Number(o.gold), unit: "gp" } : undefined,
    }));

    const backgroundData = {
      ability_scores: abilityScores,
      feat: { kind: "rule", key: featEntry.key },
      skill_proficiencies: [...skillProficiencies],
      tool_proficiency: toolProficiency.trim() || undefined,
      equipment_options,
    };

    const res = await fetch(`/api/rulesets/${currentRuleset.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            name: name.trim(),
            entry_type: "background",
            blocks: [
              ...(description.trim()
                ? [
                    {
                      block_type: "description" as const,
                      display: { label: "Description", layout: "prose" },
                      data: { segments: [{ text: description.trim() }] },
                    },
                  ]
                : []),
              { block_type: "background", display: { label: "Historique", layout: "key_values" }, data: backgroundData },
            ],
          },
        ],
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationHistorique"));
      return;
    }

    const body = (await res.json()) as { imported: { entryKey: string; name: string }[]; errors: { message: string }[] };
    if (body.errors.length > 0) {
      setError(body.errors[0].message);
      return;
    }
    clearWorldRuleEntriesCache(worldSlug);
    if (onDone) {
      onDone();
      return;
    }
    router.push(`/m/${worldSlug}/regles/${body.imported[0].entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("historiqueMaisonNeedsVariante")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("creerHistoriqueMaison")}</h1>
      <p className="text-xs text-ink-muted">{t("creerHistoriqueMaisonVariante", { name: currentRuleset.name })}</p>
      <p className="text-xs text-ink-muted">{t("creerHistoriqueMaisonIntro")}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("nomDeLHistorique")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionDeLHistorique")}
        <DescriptionTextarea value={description} onChange={setDescription} rows={3} />
      </div>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("caracteristiques")}
        <div className="flex gap-2">
          {abilityScores.map((value, index) => (
            <Dropdown
              key={index}
              value={value}
              options={ABILITIES.map((a) => ({ value: a, label: ABILITY_LABELS[a] }))}
              onChange={(v) => setAbilityAt(index, v as Ability)}
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("competencesMaitrisees")}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
          {SKILLS.map((skill) => (
            <Checkbox
              key={skill}
              checked={skillProficiencies.has(skill)}
              onChange={() => toggleSkill(skill)}
              label={<span className="text-xs text-ink">{SKILL_LABELS_FR[skill]}</span>}
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("maitriseDOutil")}
        <input
          value={toolProficiency}
          onChange={(e) => setToolProficiency(e.target.value)}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <span className="text-sm text-ink">{t("donAccorde")}</span>
        <RuleEntryAutocomplete
          worldSlug={worldSlug}
          entryTypes={FEAT_ENTRY_TYPES}
          value={featKey}
          onChange={setFeatKey}
          placeholder={t("rechercherUnDon")}
        />
        {featKey.trim() !== "" && !featEntry && <p className="text-xs text-danger">{t("erreurDonInconnu")}</p>}
        <p className="text-xs text-ink-muted">
          {t("donIntrouvableAide")}{" "}
          <a href={openDonLink.href} onClick={openDonLink.onClick} className="text-link-rule underline-offset-2 hover:underline">
            {t("creerDonMaison")}
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("equipementDeDepart")}</span>
        {equipmentOptions.map((option, optionIndex) => (
          <div key={optionIndex} className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">{t("optionEquipement", { letter: option.label })}</span>
              {equipmentOptions.length > 1 && (
                <button type="button" onClick={() => removeOption(optionIndex)} className="text-xs text-danger hover:underline">
                  {t("retirerOption")}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {option.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-1.5">
                  <div className="flex-1">
                    <RuleEntryAutocomplete
                      worldSlug={worldSlug}
                      entryTypes={EQUIPMENT_ENTRY_TYPES}
                      value={item.key}
                      onChange={(key) => updateItem(optionIndex, itemIndex, { key })}
                      placeholder={t("rechercherUnObjet")}
                      className="w-full rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(optionIndex, itemIndex, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-14 shrink-0 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(optionIndex, itemIndex)}
                    className="shrink-0 text-xs text-danger hover:underline"
                  >
                    {t("retirerOption")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addItem(optionIndex)}
                className="self-start text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {t("ajouterObjet")}
              </button>
            </div>

            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("orDeDepart")}
              <input
                type="number"
                min={0}
                value={option.gold}
                onChange={(e) => updateOption(optionIndex, { gold: e.target.value })}
                className="w-24 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
        >
          {t("ajouterOption")}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? t("creationEnCours") : t("creerHistorique")}
      </button>
    </form>
  );
}
