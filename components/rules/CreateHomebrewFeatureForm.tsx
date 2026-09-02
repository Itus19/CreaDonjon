"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
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
 * Aucune mecanique chiffree ici : `feature` n'a aucun bloc requis
 * (`REQUIRED_BLOCKS`) et le moteur ne consomme aujourd'hui les dons que de
 * facon descriptive (verifie : meme "Vigilant"/Alert, importe du SRD, ne
 * porte aucun modificateur chiffre cote moteur — src/server/services/
 * resolvedRuleset.ts resout toute aptitude generique avec `modifiers: []`).
 * Donner un effet mecanique reel a un don, maison ou officiel, est un
 * chantier moteur a part (generaliser `Modifier[]` a une lecture de bloc
 * plutot qu'aux seuls mappers Espece/Historique codes en dur) — hors de
 * portee de ce formulaire, qui reste volontairement descriptif comme
 * l'import SRD lui-meme.
 */
export default function CreateHomebrewFeatureForm({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prerequisites, setPrerequisites] = useState<string[]>([]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim() || !description.trim()) return;

    setSubmitting(true);
    setError(null);

    const cleanPrerequisites = prerequisites.map((p) => p.trim()).filter((p) => p.length > 0);

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
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
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

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionDuDon")}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

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
