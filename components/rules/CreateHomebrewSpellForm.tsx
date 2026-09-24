"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import { clearWorldRuleEntriesCache, useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import { DAMAGE_TYPE_LABELS_FR, MAGIC_SCHOOL_LABELS_FR } from "@/src/i18n/fr";
import { ABILITY_LABELS } from "@/src/core/rules/sheet";
import { SAVE_ABILITIES, SPELL_DAMAGE_TYPES, SPELL_SCHOOLS, type HomebrewSpellEffectInput } from "@/src/core/rules/homebrewSpell";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
  content_origin: string;
}

type Component = "V" | "S" | "M";

const INPUT = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";
const SMALL_INPUT = "rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none";

const DEFAULT_EFFECT: HomebrewSpellEffectInput = {
  kind: "save",
  ability: "dex",
  attackRange: "ranged",
  formula: "",
  damageType: "fire",
  onSuccess: "half",
};

/**
 * Formulaire dedie « Creer un sort » (V2-N2) — meme famille que
 * `CreateHomebrewSubclassForm.tsx` : il ecrit dans la variante ACTIVE et
 * dit laquelle, origine comprise (decision de l'auteur, 24 septembre).
 *
 * Toujours : les champs de `spell_casting` et les classes qui peuvent
 * apprendre le sort. Replie par defaut, et c'est voulu : l'effet chiffre,
 * que quatre sorts sur cinq du SRD n'ont pas — ouvrir la section ne doit
 * pas donner l'impression qu'il faut la remplir. La montee en puissance
 * n'apparait qu'avec un effet : sans formule de base, il n'y a rien a faire
 * monter. La forme ecrite en base est construite cote serveur
 * (`buildHomebrewSpellEntry`), jamais ici.
 */
export default function CreateHomebrewSpellForm({
  worldSlug,
  onDone,
}: {
  worldSlug: string;
  /** Ouvert en fenetre flottante : ferme la fenetre au lieu de naviguer vers la fiche creee. */
  onDone?: () => void;
}) {
  const t = useTranslations("regles");
  const router = useRouter();
  const classes = useWorldRuleEntries(worldSlug).filter((e) => e.entryType === "class");

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [school, setSchool] = useState<string>("Evocation");
  const [castingTime, setCastingTime] = useState("1 action");
  const [range, setRange] = useState("");
  const [duration, setDuration] = useState("Instantanée");
  const [components, setComponents] = useState<Component[]>(["V", "S"]);
  const [material, setMaterial] = useState("");
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [description, setDescription] = useState("");
  const [pageRef, setPageRef] = useState("");
  const [classKeys, setClassKeys] = useState<string[]>([]);
  const [effect, setEffect] = useState<HomebrewSpellEffectInput | null>(null);
  const [scaling, setScaling] = useState<{ level: string; formula: string }[]>([]);

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

  const spellLevel = Number(level) || 0;

  function toggleComponent(c: Component) {
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : (["V", "S", "M"] as const).filter((x) => x === c || prev.includes(x))));
  }

  function toggleClass(key: string) {
    setClassKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function updateEffect(patch: Partial<HomebrewSpellEffectInput>) {
    setEffect((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateScaling(index: number, patch: Partial<{ level: string; formula: string }>) {
    setScaling((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const canSubmit =
    !submitting &&
    name.trim() !== "" &&
    castingTime.trim() !== "" &&
    range.trim() !== "" &&
    duration.trim() !== "" &&
    classKeys.length > 0 &&
    (effect === null || effect.formula.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !canSubmit) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/rulesets/${currentRuleset.id}/spells`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        level: spellLevel,
        school,
        castingTime,
        range,
        components,
        material,
        duration,
        concentration,
        ritual,
        description,
        pageRef,
        effect,
        scaling: effect ? scaling.map((row) => ({ level: Number(row.level) || 0, formula: row.formula })) : [],
        classKeys,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationSort"));
      return;
    }

    const body = (await res.json()) as { entryKey: string };
    clearWorldRuleEntriesCache(worldSlug);
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

  const origin = currentRuleset.content_origin === "personal_reference" ? t("origineReferencePersonnelle") : t("origineRegleMaison");

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("creerSortMaison")}</h1>
      <p className="text-xs text-ink-muted">{t("creerSortVariante", { name: currentRuleset.name, origin })}</p>
      <p className="text-xs text-ink-muted">{t("creerSortIntro")}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("nomDuSort")}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={INPUT} />
      </label>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1 text-sm text-ink">
          {t("niveauDuSort")}
          <Dropdown
            size="md"
            value={level}
            options={Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: i === 0 ? t("tourDeMagie") : String(i) }))}
            onChange={setLevel}
            aria-label={t("niveauDuSort")}
          />
        </div>
        <div className="flex flex-col gap-1 text-sm text-ink">
          {t("ecoleDuSort")}
          <Dropdown
            size="md"
            value={school}
            options={SPELL_SCHOOLS.map((s) => ({ value: s, label: MAGIC_SCHOOL_LABELS_FR[s] ?? s }))}
            onChange={setSchool}
            aria-label={t("ecoleDuSort")}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("tempsIncantation")}
          <input value={castingTime} onChange={(e) => setCastingTime(e.target.value)} required maxLength={120} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("portee")}
          <input value={range} onChange={(e) => setRange(e.target.value)} required maxLength={120} placeholder="36 mètres" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("dureeDuSort")}
          <input value={duration} onChange={(e) => setDuration(e.target.value)} required maxLength={120} className={INPUT} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("composantes")}</span>
        <div className="flex flex-wrap items-center gap-4">
          {(["V", "S", "M"] as const).map((c) => (
            <Checkbox key={c} checked={components.includes(c)} onChange={() => toggleComponent(c)} label={c} />
          ))}
          <Checkbox checked={concentration} onChange={() => setConcentration((v) => !v)} label={t("concentration")} />
          <Checkbox checked={ritual} onChange={() => setRitual((v) => !v)} label={t("rituel")} />
        </div>
        {components.includes("M") && (
          <label className="flex flex-col gap-1 text-sm text-ink">
            {t("composanteMateriel")}
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              maxLength={300}
              placeholder={t("composanteMaterielExemple")}
              className={INPUT}
            />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionCourte")}
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className={INPUT} />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("referenceDePage")}
        <input value={pageRef} onChange={(e) => setPageRef(e.target.value)} maxLength={120} placeholder={t("referenceDePageExemple")} className={INPUT} />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("classesAutorisees")}</span>
        <p className="text-xs text-ink-muted">{t("classesAutoriseesAide")}</p>
        {classes.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("aucuneClasse")}</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {classes.map((c) => (
              <Checkbox key={c.key} checked={classKeys.includes(c.key)} onChange={() => toggleClass(c.key)} label={c.name} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <span className="text-sm text-ink">{t("effetChiffre")}</span>
        <p className="text-xs text-ink-muted">{t("effetChiffreAide")}</p>

        {effect === null ? (
          <button
            type="button"
            onClick={() => setEffect(DEFAULT_EFFECT)}
            className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
          >
            {t("ajouterEffetChiffreSort")}
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Dropdown
                value={effect.kind}
                options={[
                  { value: "save", label: t("effetSauvegarde") },
                  { value: "attack", label: t("effetAttaque") },
                  { value: "none", label: t("effetAucun") },
                ]}
                onChange={(v) => updateEffect({ kind: v as HomebrewSpellEffectInput["kind"] })}
                aria-label={t("typeEffet")}
              />
              {effect.kind === "save" && (
                <Dropdown
                  value={effect.ability}
                  options={SAVE_ABILITIES.map((a) => ({ value: a, label: `${t("caracteristiqueSauvegarde")} ${ABILITY_LABELS[a]}` }))}
                  onChange={(v) => updateEffect({ ability: v })}
                  aria-label={t("caracteristiqueSauvegarde")}
                />
              )}
              {effect.kind === "attack" && (
                <Dropdown
                  value={effect.attackRange}
                  options={[
                    { value: "ranged", label: t("attaqueDistance") },
                    { value: "melee", label: t("attaqueCorpsACorps") },
                  ]}
                  onChange={(v) => updateEffect({ attackRange: v as HomebrewSpellEffectInput["attackRange"] })}
                  aria-label={t("porteeAttaque")}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={effect.formula}
                onChange={(e) => updateEffect({ formula: e.target.value })}
                placeholder={t("formuleDegatsExemple")}
                aria-label={t("formuleDegats")}
                maxLength={60}
                className={`w-28 ${SMALL_INPUT}`}
              />
              <Dropdown
                value={effect.damageType}
                options={SPELL_DAMAGE_TYPES.map((d) => ({ value: d, label: DAMAGE_TYPE_LABELS_FR[d] ?? d }))}
                onChange={(v) => updateEffect({ damageType: v })}
                aria-label={t("typeDegats")}
              />
              {effect.kind === "save" && (
                <Dropdown
                  value={effect.onSuccess}
                  options={[
                    { value: "half", label: t("reussiteMoitie") },
                    { value: "none", label: t("reussiteAucun") },
                    { value: "other", label: t("reussiteAutre") },
                  ]}
                  onChange={(v) => updateEffect({ onSuccess: v as HomebrewSpellEffectInput["onSuccess"] })}
                  aria-label={t("reussiteSauvegarde")}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5 border-t border-edge/40 pt-2">
              <span className="text-sm text-ink">{t("monteeEnPuissance")}</span>
              <p className="text-xs text-ink-muted">
                {spellLevel === 0 ? t("monteeEnPuissanceAideTour") : t("monteeEnPuissanceAideEmplacement", { level: spellLevel })}
              </p>
              {scaling.map((row, index) => (
                <div key={index} className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.level}
                    onChange={(e) => updateScaling(index, { level: e.target.value })}
                    aria-label={t("palierNiveau")}
                    title={t("palierNiveau")}
                    className={`w-16 ${SMALL_INPUT}`}
                  />
                  <input
                    value={row.formula}
                    onChange={(e) => updateScaling(index, { formula: e.target.value })}
                    aria-label={t("palierFormule")}
                    placeholder={t("palierFormule")}
                    maxLength={60}
                    className={`w-28 ${SMALL_INPUT}`}
                  />
                  <button
                    type="button"
                    onClick={() => setScaling((prev) => prev.filter((_, i) => i !== index))}
                    className="text-xs text-danger hover:underline"
                  >
                    {t("retirerPalier")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setScaling((prev) => [...prev, { level: String(spellLevel === 0 ? 5 : spellLevel + 1), formula: "" }])}
                className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel"
              >
                {t("ajouterPalier")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEffect(null);
                setScaling([]);
              }}
              className="self-start text-xs text-danger hover:underline"
            >
              {t("retirerEffetChiffre")}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? t("creationEnCours") : t("creerSort")}
      </button>
    </form>
  );
}
