"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import DescriptionTextarea from "@/components/rules/DescriptionTextarea";
import { MODIFIER_OP_LABELS_FR, modifierTargetLabel } from "@/src/i18n/fr";
import { MODIFIER_TARGET_OPTIONS, OPS_BY_TARGET_CATEGORY, modifierOpNeedsValue, modifierTargetOption } from "@/src/core/rules/modifierTargets";
import type { ModifierOp } from "@/src/core/rules/sheet";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
}

interface ModifierDraft {
  target: string;
  op: ModifierOp;
  value: string;
}

const TARGET_DROPDOWN_OPTIONS = MODIFIER_TARGET_OPTIONS.map((o) => ({ value: o.target, label: modifierTargetLabel(o.target) }));

function defaultOpForTarget(target: string): ModifierOp {
  const option = modifierTargetOption(target);
  return option ? OPS_BY_TARGET_CATEGORY[option.category][0] : "add";
}

/**
 * Formulaire dedie "Creer un don ou une aptitude" — meme famille que
 * `CreateHomebrewBackgroundForm.tsx`/`CreateHomebrewWeaponForm.tsx`, mais
 * pour `entry_type: "feature"` (categorie SRD "Feats", et plus largement
 * toute aptitude nommee independante d'une classe). Premiere brique de la
 * refonte des outils de regles (retour utilisateur) : c'est l'entree que
 * `CreateHomebrewBackgroundForm.tsx` recherche desormais via
 * `RuleEntryAutocomplete` pour son champ "don accorde", au lieu de creer
 * elle-meme une entree compagnon a la volee.
 *
 * "Effets chiffres" (optionnel) genere un bloc `modifiers`, lu par
 * `resolvedRuleset.ts`/`characterSheet()` (retour utilisateur : "generalise
 * les modificateurs d'abord" — le moteur ne se contentait avant que de
 * texte descriptif pour tout don, meme officiel). Cibles fermees
 * (`MODIFIER_TARGET_OPTIONS`) : seules celles reellement calculees par la
 * fiche derivee sont proposees — pas d'"Initiative" par exemple, jamais
 * suivie par `characterSheet()` aujourd'hui, qui serait une promesse non
 * tenue. Un don dont l'effet ne rentre dans aucune de ces cibles (la
 * plupart des dons reels — relances conditionnelles, avantages situationnels)
 * reste purement descriptif, comme "Chanceux"/"Indomptable" du SRD
 * aujourd'hui : `creerDonMaisonIntro` le dit explicitement.
 */
export default function CreateHomebrewFeatureForm({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [modifiers, setModifiers] = useState<ModifierDraft[]>([]);

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

  function updatePrerequisite(index: number, value: string) {
    setPrerequisites((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPrerequisite() {
    setPrerequisites((prev) => [...prev, ""]);
  }

  function removePrerequisite(index: number) {
    setPrerequisites((prev) => prev.filter((_, i) => i !== index));
  }

  function addModifier() {
    const target = MODIFIER_TARGET_OPTIONS[0].target;
    setModifiers((prev) => [...prev, { target, op: defaultOpForTarget(target), value: "1" }]);
  }

  function updateModifierTarget(index: number, target: string) {
    setModifiers((prev) => prev.map((m, i) => (i === index ? { ...m, target, op: defaultOpForTarget(target) } : m)));
  }

  function updateModifierOp(index: number, op: ModifierOp) {
    setModifiers((prev) => prev.map((m, i) => (i === index ? { ...m, op } : m)));
  }

  function updateModifierValue(index: number, value: string) {
    setModifiers((prev) => prev.map((m, i) => (i === index ? { ...m, value } : m)));
  }

  function removeModifier(index: number) {
    setModifiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim() || !description.trim()) return;

    setSubmitting(true);
    setError(null);

    const cleanPrerequisites = prerequisites.map((p) => p.trim()).filter((p) => p.length > 0);
    const cleanModifiers = modifiers.map((m) => ({
      target: m.target,
      op: m.op,
      ...(modifierOpNeedsValue(m.op) ? { value: Number(m.value) || 0 } : {}),
    }));

    const res = await fetch(`/api/rulesets/${currentRuleset.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            name: name.trim(),
            entry_type: "feature",
            blocks: [
              {
                block_type: "description",
                display: { label: "Description", layout: "prose" },
                data: { segments: [{ text: description.trim() }] },
              },
              ...(cleanPrerequisites.length > 0
                ? [
                    {
                      block_type: "prerequisites" as const,
                      display: { label: "Prérequis", layout: "chips" },
                      data: { items: cleanPrerequisites },
                    },
                  ]
                : []),
              ...(cleanModifiers.length > 0
                ? [
                    {
                      block_type: "modifiers" as const,
                      display: { label: "Effets chiffrés", layout: "key_values" },
                      data: { modifiers: cleanModifiers },
                    },
                  ]
                : []),
            ],
          },
        ],
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationDon"));
      return;
    }

    const body = (await res.json()) as { imported: { entryKey: string; name: string }[]; errors: { message: string }[] };
    if (body.errors.length > 0) {
      setError(body.errors[0].message);
      return;
    }
    router.push(`/m/${worldSlug}/regles/${body.imported[0].entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("donMaisonNeedsVariante")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("creerDonMaison")}</h1>
      <p className="text-xs text-ink-muted">{t("creerDonMaisonVariante", { name: currentRuleset.name })}</p>
      <p className="text-xs text-ink-muted">{t("creerDonMaisonIntro")}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("nomDuDon")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionDuDon")}
        <DescriptionTextarea value={description} onChange={setDescription} required rows={4} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("prerequis")}</span>
        {prerequisites.map((p, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={p}
              onChange={(e) => updatePrerequisite(index, e.target.value)}
              placeholder={t("prerequisExemple")}
              className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <button type="button" onClick={() => removePrerequisite(index)} className="shrink-0 text-xs text-danger hover:underline">
              {t("retirerOption")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addPrerequisite}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
        >
          {t("ajouterPrerequis")}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <span className="text-sm text-ink">{t("effetsChiffres")}</span>
        <p className="text-xs text-ink-muted">{t("effetsChiffresAide")}</p>
        {modifiers.map((modifier, index) => {
          const needsValue = modifierOpNeedsValue(modifier.op);
          const category = modifierTargetOption(modifier.target)?.category;
          const opOptions = (category ? OPS_BY_TARGET_CATEGORY[category] : (["add"] as const)).map((op) => ({
            value: op,
            label: MODIFIER_OP_LABELS_FR[op],
          }));
          return (
            <div key={index} className="flex flex-wrap items-center gap-1.5">
              <Dropdown
                value={modifier.target}
                options={TARGET_DROPDOWN_OPTIONS}
                onChange={(v) => updateModifierTarget(index, v)}
                className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
              />
              <Dropdown
                value={modifier.op}
                options={opOptions}
                onChange={(v) => updateModifierOp(index, v as ModifierOp)}
                className="shrink-0 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
              />
              {needsValue && (
                <input
                  type="number"
                  value={modifier.value}
                  onChange={(e) => updateModifierValue(index, e.target.value)}
                  className="w-16 shrink-0 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
              )}
              <button type="button" onClick={() => removeModifier(index)} className="shrink-0 text-xs text-danger hover:underline">
                {t("retirerOption")}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addModifier}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
        >
          {t("ajouterEffetChiffre")}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim() || !description.trim()}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? t("creationEnCours") : t("creerDon")}
      </button>
    </form>
  );
}
