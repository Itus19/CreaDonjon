"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import { clearWorldRuleEntriesCache, useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import { subclassFormValues } from "@/src/core/rules/homebrewEdit";
import { useHomebrewEntryForEdit } from "@/components/rules/useHomebrewEntryForEdit";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
  content_origin: string;
}

/** V3.1-182 : un sort accordé par l'aptitude, en brouillon d'écran. `gratuit` : combien de fois sans emplacement (« 0 » : jamais). */
interface SortDraft {
  key: string;
  alwaysPrepared: boolean;
  gratuit: string;
  repos: "short_rest" | "long_rest";
}

interface FeatureDraft {
  name: string;
  level: string;
  description: string;
  spells: SortDraft[];
}

const EMPTY_FEATURE: FeatureDraft = { name: "", level: "3", description: "", spells: [] };
const EMPTY_SORT: SortDraft = { key: "", alwaysPrepared: true, gratuit: "0", repos: "long_rest" };

/**
 * V3.1-182 — Le choix d'un sort parmi ceux du monde (plusieurs centaines) :
 * un champ de recherche et quelques propositions dessous. La charte écarte le
 * `<select>` natif et `Dropdown` n'a pas de recherche ; le nom choisi
 * s'affiche, la clé part au serveur.
 */
function ChoixSort({ sorts, value, onChange }: { sorts: readonly { key: string; name: string }[]; value: string; onChange: (key: string) => void }) {
  const t = useTranslations("regles");
  const [requete, setRequete] = useState("");
  const choisi = sorts.find((s) => s.key === value);
  if (choisi) {
    return (
      <span className="flex items-center gap-2">
        <span className="rounded-md border border-edge px-2 py-1 text-sm text-ink">{choisi.name}</span>
        <button type="button" onClick={() => onChange("")} className="text-xs text-ink-muted hover:text-ink">
          {t("sortsAccordes.changer")}
        </button>
      </span>
    );
  }
  const q = requete.trim().toLocaleLowerCase("fr");
  const propositions = q.length < 2 ? [] : sorts.filter((s) => s.name.toLocaleLowerCase("fr").includes(q)).slice(0, 6);
  return (
    <span className="flex min-w-48 flex-col gap-1">
      <input
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder={t("sortsAccordes.chercher")}
        aria-label={t("sortsAccordes.chercher")}
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
      />
      {propositions.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {propositions.map((s) => (
            <button key={s.key} type="button" onClick={() => onChange(s.key)} className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink hover:bg-panel-raised">
              {s.name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

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
  const reglesDuMonde = useWorldRuleEntries(worldSlug);
  const classes = reglesDuMonde.filter((e) => e.entryType === "class");
  const sortsDuMonde = reglesDuMonde.filter((e) => e.entryType === "spell").map((e) => ({ key: e.key, name: e.name }));
  // V3.1-182 : les aptitudes dont le repli « Sorts accordés » est ouvert (par position).
  const [sortsOuverts, setSortsOuverts] = useState<ReadonlySet<number>>(() => new Set());

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
    setFeatures(
      v.features.length > 0
        ? v.features.map((f) => ({
            name: f.name,
            level: String(f.level),
            description: f.description,
            spells: (f.spells ?? []).map((sp) => ({ key: sp.key, alwaysPrepared: sp.alwaysPrepared, gratuit: String(sp.freeCast?.uses ?? 0), repos: sp.freeCast?.refresh ?? "long_rest" })),
          }))
        : [EMPTY_FEATURE]
    );
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
        features: features.map((f) => ({
          name: f.name,
          level: Number(f.level) || 1,
          description: f.description,
          spells: f.spells
            .filter((sp) => sp.key !== "")
            .map((sp) => ({ key: sp.key, alwaysPrepared: sp.alwaysPrepared, ...(Number(sp.gratuit) > 0 ? { freeCast: { uses: Number(sp.gratuit), refresh: sp.repos } } : {}) })),
        })),
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
    // La page de la nouvelle regle est dynamique : la navigation la demande
    // fraiche au serveur, et la liste laterale s'est rechargee sur
    // `clearWorldRuleEntriesCache`. Plus de `router.refresh()` en plus (C5).
    router.push(`/m/${worldSlug}/regles/${body.entryKey}`);
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
            <SortsAccordes
              ouvert={sortsOuverts.has(index)}
              onBasculer={() =>
                setSortsOuverts((avant) => {
                  const apres = new Set(avant);
                  if (apres.has(index)) apres.delete(index);
                  else apres.add(index);
                  return apres;
                })
              }
              sorts={feature.spells}
              sortsDuMonde={sortsDuMonde}
              onChange={(spells) => updateFeature(index, { spells })}
            />
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

/**
 * V3.1-182 — Sous une aptitude, le repli « Sorts accordés (n) » : une ligne par
 * sort — le sort, « toujours préparé », et combien de fois il se lance sans
 * emplacement, jusqu'à quel repos. Le moteur lit déjà ces sorts
 * (`subclass_features.spells`) ; l'écran les rend saisissables.
 */
function SortsAccordes({
  ouvert,
  onBasculer,
  sorts,
  sortsDuMonde,
  onChange,
}: {
  ouvert: boolean;
  onBasculer: () => void;
  sorts: SortDraft[];
  sortsDuMonde: readonly { key: string; name: string }[];
  onChange: (sorts: SortDraft[]) => void;
}) {
  const t = useTranslations("regles.sortsAccordes");
  const maj = (i: number, patch: Partial<SortDraft>) => onChange(sorts.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="flex basis-full flex-col gap-1.5">
      <button type="button" aria-expanded={ouvert} onClick={onBasculer} className="w-fit text-xs font-medium text-accent hover:underline">
        {ouvert ? "▴" : "▾"} {t("titre", { n: sorts.length })}
      </button>
      {ouvert && (
        <div className="flex flex-col gap-2 rounded-r-md border-l-[3px] border-accent bg-panel-raised px-2.5 py-2">
          {sorts.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <ChoixSort sorts={sortsDuMonde} value={s.key} onChange={(key) => maj(i, { key })} />
              <Checkbox checked={s.alwaysPrepared} onChange={() => maj(i, { alwaysPrepared: !s.alwaysPrepared })} label={t("toujoursPrepare")} />
              <span>{t("sansEmplacement")}</span>
              <Dropdown
                value={s.gratuit}
                options={["0", "1", "2", "3"].map((n) => ({ value: n, label: n === "0" ? t("jamais") : n }))}
                onChange={(gratuit) => maj(i, { gratuit })}
                aria-label={t("sansEmplacement")}
              />
              {s.gratuit !== "0" && (
                <>
                  <span>{t("par")}</span>
                  <Dropdown
                    value={s.repos}
                    options={[
                      { value: "long_rest", label: t("reposLong") },
                      { value: "short_rest", label: t("reposCourt") },
                    ]}
                    onChange={(repos) => maj(i, { repos: repos === "short_rest" ? "short_rest" : "long_rest" })}
                    aria-label={t("repos")}
                  />
                </>
              )}
              <button type="button" onClick={() => onChange(sorts.filter((_, j) => j !== i))} className="text-xs text-danger hover:underline">
                {t("retirer")}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...sorts, EMPTY_SORT])}
            className="w-fit rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel"
          >
            {t("ajouter")}
          </button>
        </div>
      )}
    </div>
  );
}
