"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import { clearWorldRuleEntriesCache, useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import { subclassFormValues } from "@/src/core/rules/homebrewEdit";
import { useHomebrewEntryForEdit } from "@/components/rules/useHomebrewEntryForEdit";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
  content_origin: string;
}

interface FeatureDraft {
  name: string;
  level: string;
  description: string;
}

const EMPTY_FEATURE: FeatureDraft = { name: "", level: "3", description: "" };

/**
 * Formulaire dedie « Creer une sous-classe » (V2-N1) — meme famille que
 * `CreateHomebrewFeatureForm.tsx` : il ecrit dans la variante ACTIVE du
 * monde, et le dit en toutes lettres, origine comprise (« reference
 * personnelle » ou « variante maison »). C'est l'option retenue par
 * l'auteur le 24 septembre : pas de bascule implicite vers une autre
 * couche, mais jamais non plus une cible qu'on ne voit pas.
 *
 * Aucun champ « texte long » : une description courte, une reference de
 * page, et des aptitudes (nom, niveau, quelques mots). La prose d'un livre
 * se reference, elle ne se recopie pas (specs/ruleset-personnel.md §1).
 * L'ecriture elle-meme — la fiche, puis l'option dans le `subclass_slot`
 * de la classe — vit cote serveur (`createHomebrewSubclass`).
 */
export default function CreateHomebrewSubclassForm({
  worldSlug,
  onDone,
  edit,
}: {
  worldSlug: string;
  /** Ouvert en fenetre flottante : ferme la fenetre au lieu de naviguer vers la fiche creee. */
  onDone?: () => void;
  /** V3.1-2 : rouvre une fiche maison existante pour la modifier en place (meme cle, meme classe parente). */
  edit?: { entryKey: string; onCancel: () => void };
}) {
  const t = useTranslations("regles");
  const router = useRouter();
  const classes = useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "class");

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [parentClassKey, setParentClassKey] = useState("");
  const [description, setDescription] = useState("");
  const [pageRef, setPageRef] = useState("");
  const [features, setFeatures] = useState<FeatureDraft[]>([EMPTY_FEATURE]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Cree, mais sa classe n'a pas d'emplacement de sous-classe : on reste sur un ecran de fin plutot que sur un formulaire encore rempli, qu'un second clic dupliquerait. */
  const [createdWithoutSlot, setCreatedWithoutSlot] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/ruleset`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { options: SelectableRuleset[]; current: string | null }) => {
        setCurrentRuleset(body.options.find((o) => o.id === body.current) ?? null);
      })
      .catch(() => setError(t("erreurChargementRulesets")))
      .finally(() => setLoading(false));
  }, [worldSlug, t]);

  // V3.1-2 : pre-remplir depuis la fiche relue, une seule fois.
  const { entry: editEntry, error: editError } = useHomebrewEntryForEdit(currentRuleset?.id ?? null, edit?.entryKey);
  // Ajuste l'etat pendant le rendu plutot que dans un effet (meme motif
  // que `EntityTree.tsx`) : le formulaire se remplit au premier rendu
  // qui dispose de la fiche, sans rendu intermediaire vide.
  const [prefilledFrom, setPrefilledFrom] = useState<typeof editEntry>(null);
  if (editEntry && editEntry !== prefilledFrom) {
    setPrefilledFrom(editEntry);
    const v = subclassFormValues(editEntry.blocks);
    setName(editEntry.name);
    setParentClassKey(editEntry.parentClassKey ?? "");
    setDescription(v.description);
    setPageRef(v.pageRef);
    setFeatures(v.features.length > 0 ? v.features.map((f) => ({ name: f.name, level: String(f.level), description: f.description })) : [EMPTY_FEATURE]);
  }

  function updateFeature(index: number, patch: Partial<FeatureDraft>) {
    setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  const hasNamedFeature = features.some((f) => f.name.trim().length > 0);
  const canSubmit = !submitting && name.trim().length > 0 && parentClassKey !== "" && hasNamedFeature;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/rulesets/${currentRuleset.id}/subclasses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentClassKey,
        description,
        pageRef,
        features: features.map((f) => ({ name: f.name, level: Number(f.level) || 1, description: f.description })),
        ...(edit ? { entryKey: edit.entryKey } : {}),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationSousClasse"));
      return;
    }

    const body = (await res.json()) as { entryKey: string; slotUpdated: boolean };
    clearWorldRuleEntriesCache(worldSlug);
    // Une modification ne touche pas l'emplacement de la classe (deja a jour depuis la creation).
    if (edit) {
      onDone?.();
      return;
    }
    // Une classe sans emplacement de sous-classe ne la proposera jamais a
    // la creation de personnage : on le dit ici, plutot que de fermer la
    // fenetre sur un succes qui n'en est qu'a moitie un.
    if (!body.slotUpdated) {
      setCreatedWithoutSlot(body.entryKey);
      return;
    }
    if (onDone) {
      onDone();
      return;
    }
    router.push(`/m/${worldSlug}/regles/${body.entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("donMaisonNeedsVariante")}</p>;
  }

  if (createdWithoutSlot) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm text-ink">{t("sousClasseSansEmplacement")}</p>
        <Link
          href={`/m/${worldSlug}/regles/${createdWithoutSlot}`}
          onClick={() => onDone?.()}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
        >
          {t("voirLaSousClasse")}
        </Link>
      </div>
    );
  }

  if (edit && editError) return <p className="text-sm text-danger">{editError}</p>;
  if (edit && !editEntry) return <p className="text-sm text-ink-muted">{t("lectureFiche")}</p>;

  const origin = currentRuleset.content_origin === "personal_reference" ? t("origineReferencePersonnelle") : t("origineRegleMaison");

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{edit && editEntry ? t("modifierFicheMaison", { name: editEntry.name }) : t("creerSousClasseMaison")}</h1>
      <p className="text-xs text-ink-muted">{edit ? t("modifierFicheIntro") : t("creerSousClasseVariante", { name: currentRuleset.name, origin })}</p>
      {!edit && <p className="text-xs text-ink-muted">{t("creerSousClasseIntro")}</p>}

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("nomDeLaSousClasse")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("classeParente")}
        {edit ? (
          // La classe parente d'une sous-classe ne change pas : son emplacement la porte deja.
          <p className="text-sm text-ink-muted">{classes.find((c) => c.key === parentClassKey)?.name ?? parentClassKey}</p>
        ) : classes.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("aucuneClasse")}</p>
        ) : (
          <Dropdown
            size="md"
            value={parentClassKey}
            options={[{ value: "", label: t("choisirClasse") }, ...classes.map((c) => ({ value: c.key, label: c.name }))]}
            onChange={setParentClassKey}
            aria-label={t("classeParente")}
          />
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionCourte")}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("referenceDePage")}
        <input
          value={pageRef}
          onChange={(e) => setPageRef(e.target.value)}
          placeholder={t("referenceDePageExemple")}
          maxLength={120}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <span className="text-sm text-ink">{t("aptitudesDeSousClasse")}</span>
        <p className="text-xs text-ink-muted">{t("aptitudesDeSousClasseAide")}</p>
        {features.map((feature, index) => (
          <div key={index} className="flex flex-wrap items-center gap-1.5">
            <input
              value={feature.name}
              onChange={(e) => updateFeature(index, { name: e.target.value })}
              placeholder={t("nomDeLAptitude")}
              aria-label={t("nomDeLAptitude")}
              className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <input
              type="number"
              min={1}
              max={20}
              value={feature.level}
              onChange={(e) => updateFeature(index, { level: e.target.value })}
              aria-label={t("niveauDeLAptitude")}
              title={t("niveauDeLAptitude")}
              className="w-16 shrink-0 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <input
              value={feature.description}
              onChange={(e) => updateFeature(index, { description: e.target.value })}
              placeholder={t("descriptionDeLAptitude")}
              aria-label={t("descriptionDeLAptitude")}
              className="min-w-0 basis-full rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none sm:basis-auto sm:flex-[2]"
            />
            {features.length > 1 && (
              <button
                type="button"
                onClick={() => setFeatures((prev) => prev.filter((_, i) => i !== index))}
                className="shrink-0 text-xs text-danger hover:underline"
              >
                {t("retirerAptitude")}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFeatures((prev) => [...prev, EMPTY_FEATURE])}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
        >
          {t("ajouterAptitude")}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? (edit ? t("enregistrementEnCours") : t("creationEnCours")) : edit ? t("enregistrerModifications") : t("creerSousClasse")}
        </button>
        {edit && (
          <button type="button" onClick={edit.onCancel} className="text-sm text-ink-muted hover:text-ink">
            {t("annulerModification")}
          </button>
        )}
      </div>
    </form>
  );
}
