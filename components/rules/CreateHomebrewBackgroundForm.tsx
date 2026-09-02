"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ABILITIES, ABILITY_LABELS, SKILLS, type Ability, type Skill } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { slugify } from "@/src/core/slug/slug";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
}

interface EquipmentOptionDraft {
  label: string;
  itemsText: string;
  gold: string;
}

/** "2 Dague" / "Dague x2" -> quantite 2, sinon 1. Toujours un libelle libre, jamais de `ref` vers une fiche existante. */
function parseEquipmentLine(line: string): { label: string; quantity: number } {
  const trimmed = line.trim();
  const leading = trimmed.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
  if (leading) return { label: leading[2].trim(), quantity: Math.max(1, Number(leading[1])) };
  const trailing = trimmed.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (trailing) return { label: trailing[1].trim(), quantity: Math.max(1, Number(trailing[2])) };
  return { label: trimmed, quantity: 1 };
}

function nextOptionLabel(count: number): string {
  return String.fromCharCode(65 + count);
}

/**
 * Contrairement a `CreateHomebrewWeaponForm.tsx`, aucune assistance IA ici : le contenu de manuel ne se saisit jamais automatiquement (CLAUDE.md).
 * `feat` exige une vraie `zReference` (pas de repli "libelle") donc on cree DEUX entrees via `importRulesetEntries` : une `feature` puis le `background` qui la reference par sa cle.
 */
export default function CreateHomebrewBackgroundForm({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [abilityScores, setAbilityScores] = useState<Ability[]>(["str", "dex", "con"]);
  const [skillProficiencies, setSkillProficiencies] = useState<Set<Skill>>(new Set());
  const [toolProficiency, setToolProficiency] = useState("");
  const [featName, setFeatName] = useState("");
  const [featDescription, setFeatDescription] = useState("");
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOptionDraft[]>([
    { label: "A", itemsText: "", gold: "" },
    { label: "B", itemsText: "", gold: "50" },
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
    setEquipmentOptions((prev) => [...prev, { label: nextOptionLabel(prev.length), itemsText: "", gold: "" }]);
  }

  function removeOption(index: number) {
    setEquipmentOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim()) return;
    if (!featName.trim()) {
      setError(t("erreurNomDonRequis"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const featEntryKey = `${slugify(name)}-feat`;
    const equipment_options = equipmentOptions.map((o) => ({
      label: o.label,
      items: o.itemsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map(parseEquipmentLine),
      gold: o.gold.trim() ? { value: Number(o.gold), unit: "gp" } : undefined,
    }));

    const backgroundData = {
      ability_scores: abilityScores,
      feat: { kind: "rule", key: featEntryKey },
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
            entry_key: featEntryKey,
            name: featName.trim(),
            entry_type: "feature",
            blocks: [
              {
                block_type: "description",
                display: { label: "Description", layout: "prose" },
                data: { segments: [{ text: featDescription.trim() }] },
              },
            ],
          },
          {
            name: name.trim(),
            entry_type: "background",
            blocks: [{ block_type: "background", display: { label: "Historique", layout: "key_values" }, data: backgroundData }],
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
    const backgroundEntry = body.imported.find((e) => e.name === name.trim());
    router.push(`/m/${worldSlug}/regles/${backgroundEntry?.entryKey ?? body.imported[0].entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("historiqueMaisonNeedsVariante")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
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
        {t("caracteristiques")}
        <div className="flex gap-2">
          {abilityScores.map((value, index) => (
            <select
              key={index}
              value={value}
              onChange={(e) => setAbilityAt(index, e.target.value as Ability)}
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            >
              {ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {ABILITY_LABELS[a]}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("competencesMaitrisees")}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {SKILLS.map((skill) => (
            <label key={skill} className="flex items-center gap-1.5 text-xs text-ink">
              <input type="checkbox" checked={skillProficiencies.has(skill)} onChange={() => toggleSkill(skill)} />
              {SKILL_LABELS_FR[skill]}
            </label>
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

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("nomDuDon")}
          <input
            value={featName}
            onChange={(e) => setFeatName(e.target.value)}
            required
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("descriptionDuDon")}
          <textarea
            value={featDescription}
            onChange={(e) => setFeatDescription(e.target.value)}
            rows={3}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("equipementDeDepart")}</span>
        {equipmentOptions.map((option, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">{t("optionEquipement", { letter: option.label })}</span>
              {equipmentOptions.length > 1 && (
                <button type="button" onClick={() => removeOption(index)} className="text-xs text-danger hover:underline">
                  {t("retirerOption")}
                </button>
              )}
            </div>
            <textarea
              value={option.itemsText}
              onChange={(e) => updateOption(index, { itemsText: e.target.value })}
              placeholder={t("objetsUnParLigne")}
              rows={3}
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("orDeDepart")}
              <input
                type="number"
                min={0}
                value={option.gold}
                onChange={(e) => updateOption(index, { gold: e.target.value })}
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
