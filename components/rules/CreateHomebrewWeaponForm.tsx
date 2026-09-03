"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";
import type { WeaponProposal } from "@/src/core/ai/weaponProposal";
import { clearWorldRuleEntriesCache, useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import DescriptionTextarea from "@/components/rules/DescriptionTextarea";
import Checkbox from "@/components/shared/Checkbox";
import Dropdown from "@/components/shared/Dropdown";
import { kgToLb, lbToKg, mToFt } from "@/src/core/rules/encumbrance";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
}

const DICE_FACES = [4, 6, 8, 10, 12] as const;
const CURRENCY_UNITS = ["gp", "sp", "cp", "ep", "pp"] as const;

function AiBadge({ shown, label }: { shown: boolean; label: string }) {
  if (!shown) return null;
  return <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">{label}</span>;
}

/**
 * Formulaire dedie "Creer une arme maison" (V1-D4, ticket : "formulaires
 * engendres depuis les schemas Zod — l'utilisateur ne voit jamais de
 * JSON"). Un composant par type de bloc plutot qu'un generateur generique
 * (decision explicite, voir docs/BACKLOG_V1.md V1-D4) : meme precedent que
 * les editeurs de bloc de personnage (`InventoryBlockEditor.tsx` etc.).
 *
 * N'ecrit que dans la variante active du monde — jamais une base officielle
 * (CLAUDE.md regle 12, deja verrouille cote serveur par
 * `upsert_ruleset_override`) : si le ruleset actif est officiel, le
 * formulaire est remplace par une invite a choisir/creer une variante
 * d'abord (le bouton "Regles actives" de la barre laterale le fait deja).
 *
 * L'assistance IA (V1-F2, specs/regles-couche.md §5) vient se greffer
 * dessus plutot que le remplacer : le meme formulaire, la meme validation,
 * le meme bouton de creation — l'IA ne fait que pre-remplir les champs
 * depuis une description libre, jamais du JSON expose a l'utilisateur.
 * Chaque champ pre-rempli par le modele est signale (§5.2 : "chaque champ
 * que le modele a rempli est signale comme tel") et le signalement
 * disparait des que l'utilisateur touche ce champ — rien de plus.
 */
export default function CreateHomebrewWeaponForm({
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
  // Proprietes/bottes d'arme sont de vraies fiches (`entry_type: "feature"`,
  // clés `weapon-property-*`/`weapon-mastery-*` — scripts/ingest-srd.ts),
  // jamais un enum fige dans le code : la liste proposee ici reflete donc
  // toujours exactement ce que porte le ruleset actif (2014 sans bottes,
  // 2024 avec), retour utilisateur ("verifie... toutes les options possibles").
  const weaponProperties = worldEntries.filter((e) => e.key.startsWith("weapon-property-"));
  const weaponMasteries = worldEntries.filter((e) => e.key.startsWith("weapon-mastery-"));

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"simple" | "martial">("simple");
  const [isRanged, setIsRanged] = useState(false);
  const [rangeNormal, setRangeNormal] = useState("");
  const [rangeLong, setRangeLong] = useState("");
  const [diceCount, setDiceCount] = useState(1);
  const [diceFaces, setDiceFaces] = useState<number>(6);
  const [damageType, setDamageType] = useState("");
  const [versatile, setVersatile] = useState(false);
  const [versatileDiceCount, setVersatileDiceCount] = useState(1);
  const [versatileDiceFaces, setVersatileDiceFaces] = useState<number>(8);
  const [propertyKeys, setPropertyKeys] = useState<Set<string>>(new Set());
  const [masteryKey, setMasteryKey] = useState("");
  const [weight, setWeight] = useState("");
  const [costQuantity, setCostQuantity] = useState("");
  const [costUnit, setCostUnit] = useState<(typeof CURRENCY_UNITS)[number]>("gp");

  const [aiHint, setAiHint] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

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

  function toggleProperty(key: string) {
    setPropertyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearAiBadge(field: string) {
    setAiFilledFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  async function handlePropose() {
    if (!aiHint.trim()) return;
    setProposing(true);
    setProposeError(null);

    const res = await fetch(`/api/worlds/${worldSlug}/rules/weapons/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: aiHint.trim() }),
    });

    setProposing(false);
    if (!res.ok) {
      setProposeError(t("erreurServiceIA"));
      return;
    }

    const body = (await res.json()) as { ok: true; proposal: WeaponProposal } | { ok: false };
    if (!body.ok) {
      setProposeError(t("propositionEchouee"));
      return;
    }

    const p = body.proposal;
    setCategory(p.category);
    setIsRanged(p.is_ranged);
    setDiceCount(p.damage_dice_count);
    setDiceFaces(p.damage_dice_faces);
    setDamageType(p.damage_type);
    const filled = new Set(["category", "is_ranged", "diceCount", "diceFaces", "damageType"]);
    if (p.versatile_dice_count && p.versatile_dice_faces) {
      setVersatile(true);
      setVersatileDiceCount(p.versatile_dice_count);
      setVersatileDiceFaces(p.versatile_dice_faces);
      filled.add("versatile");
    }
    if (p.weight_lb !== undefined) {
      setWeight(String(lbToKg(p.weight_lb)));
      filled.add("weight");
    }
    if (p.cost_quantity !== undefined) {
      setCostQuantity(String(p.cost_quantity));
      if (p.cost_unit) setCostUnit(p.cost_unit);
      filled.add("cost");
    }
    setAiFilledFields(filled);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim()) return;

    setSubmitting(true);
    setError(null);

    const weapon = {
      category,
      is_ranged: isRanged,
      damage: { dice: { op: "dice", count: diceCount, faces: diceFaces }, type: damageType.trim() || undefined },
      versatile_damage: versatile ? { op: "dice", count: versatileDiceCount, faces: versatileDiceFaces } : undefined,
      properties: [...propertyKeys].map((key) => ({ kind: "rule" as const, key })),
      mastery: masteryKey ? { kind: "rule" as const, key: masteryKey } : undefined,
      range:
        isRanged && rangeNormal.trim()
          ? {
              normal: { value: mToFt(Number(rangeNormal)), unit: "ft" },
              long: rangeLong.trim() ? { value: mToFt(Number(rangeLong)), unit: "ft" } : undefined,
            }
          : undefined,
      weight: weight.trim() ? { value: kgToLb(Number(weight)), unit: "lb" } : undefined,
      cost: costQuantity.trim() ? { value: Number(costQuantity), unit: costUnit } : undefined,
    };

    const res = await fetch(`/api/worlds/${worldSlug}/rules/weapons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rulesetId: currentRuleset.id,
        name: name.trim(),
        description: description.trim() || undefined,
        weapon,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationArme"));
      return;
    }

    const created = (await res.json()) as { entryKey: string };
    clearWorldRuleEntriesCache(worldSlug);
    if (onDone) {
      onDone();
      return;
    }
    router.push(`/m/${worldSlug}/regles/${created.entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("armeMaisonNeedsVariante")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("creerArmeMaison")}</h1>
      <p className="text-xs text-ink-muted">{t("creerArmeMaisonVariante", { name: currentRuleset.name })}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("nomDeLArme")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-ink">
        {t("descriptionDeLArme")}
        <DescriptionTextarea value={description} onChange={setDescription} rows={3} />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("descriptionLibreArme")}
          <textarea
            value={aiHint}
            onChange={(e) => setAiHint(e.target.value)}
            placeholder={t("descriptionLibreArmeExemple")}
            rows={2}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handlePropose}
          disabled={proposing || !aiHint.trim()}
          className="self-start rounded-full border border-edge px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {proposing ? t("propositionEnCours") : t("proposerAvecIA")}
        </button>
        {proposeError && <p className="text-xs text-danger">{proposeError}</p>}
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("categorieDArme")}
            <AiBadge shown={aiFilledFields.has("category")} label={t("champRempliParIA")} />
          </span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as "simple" | "martial");
              clearAiBadge("category");
            }}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="simple">{t("armeSimple")}</option>
            <option value="martial">{t("armeDeGuerre")}</option>
          </select>
        </label>
        <div className="flex items-end pb-2">
          <Checkbox
            checked={isRanged}
            onChange={() => {
              setIsRanged(!isRanged);
              clearAiBadge("is_ranged");
            }}
            label={
              <span className="flex items-center gap-1.5 text-sm text-ink">
                {t("armeADistance")}
                <AiBadge shown={aiFilledFields.has("is_ranged")} label={t("champRempliParIA")} />
              </span>
            }
          />
        </div>
      </div>

      {isRanged && (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            {t("porteeNormaleMetres")}
            <input
              type="number"
              min={0}
              step="0.5"
              value={rangeNormal}
              onChange={(e) => setRangeNormal(e.target.value)}
              className="w-28 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            {t("porteeLongueMetres")}
            <input
              type="number"
              min={0}
              step="0.5"
              value={rangeLong}
              onChange={(e) => setRangeLong(e.target.value)}
              className="w-28 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
          </label>
        </div>
      )}

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("degatsNombreDes")}
            <AiBadge shown={aiFilledFields.has("diceCount")} label={t("champRempliParIA")} />
          </span>
          <input
            type="number"
            min={1}
            value={diceCount}
            onChange={(e) => {
              setDiceCount(Math.max(1, Number(e.target.value)));
              clearAiBadge("diceCount");
            }}
            className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("degatsFaces")}
            <AiBadge shown={aiFilledFields.has("diceFaces")} label={t("champRempliParIA")} />
          </span>
          <select
            value={diceFaces}
            onChange={(e) => {
              setDiceFaces(Number(e.target.value));
              clearAiBadge("diceFaces");
            }}
            className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          >
            {DICE_FACES.map((f) => (
              <option key={f} value={f}>
                d{f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("typeDeDegats")}
            <AiBadge shown={aiFilledFields.has("damageType")} label={t("champRempliParIA")} />
          </span>
          <input
            value={damageType}
            onChange={(e) => {
              setDamageType(e.target.value);
              clearAiBadge("damageType");
            }}
            placeholder={t("typeDeDegatsExemple")}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox
          checked={versatile}
          onChange={() => {
            setVersatile(!versatile);
            clearAiBadge("versatile");
          }}
          label={
            <span className="flex items-center gap-1.5 text-sm text-ink">
              {t("armePolyvalente")}
              <AiBadge shown={aiFilledFields.has("versatile")} label={t("champRempliParIA")} />
            </span>
          }
        />
        {versatile && (
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              {t("degatsVersatileNombreDes")}
              <input
                type="number"
                min={1}
                value={versatileDiceCount}
                onChange={(e) => {
                  setVersatileDiceCount(Math.max(1, Number(e.target.value)));
                  clearAiBadge("versatile");
                }}
                className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              {t("degatsVersatileFaces")}
              <select
                value={versatileDiceFaces}
                onChange={(e) => {
                  setVersatileDiceFaces(Number(e.target.value));
                  clearAiBadge("versatile");
                }}
                className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
              >
                {DICE_FACES.map((f) => (
                  <option key={f} value={f}>
                    d{f}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {weaponProperties.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-ink">
          {t("proprietesArme")}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
            {weaponProperties.map((property) => (
              <Checkbox
                key={property.key}
                checked={propertyKeys.has(property.key)}
                onChange={() => toggleProperty(property.key)}
                label={<span className="text-xs text-ink">{property.name}</span>}
              />
            ))}
          </div>
        </div>
      )}

      {weaponMasteries.length > 0 && (
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("botteArme")}
          <Dropdown
            value={masteryKey}
            options={[{ value: "", label: t("aucuneBotte") }, ...weaponMasteries.map((m) => ({ value: m.key, label: m.name }))]}
            onChange={setMasteryKey}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
          />
        </label>
      )}

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("poidsKg")}
            <AiBadge shown={aiFilledFields.has("weight")} label={t("champRempliParIA")} />
          </span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              clearAiBadge("weight");
            }}
            className="w-24 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("cout")}
            <AiBadge shown={aiFilledFields.has("cost")} label={t("champRempliParIA")} />
          </span>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              value={costQuantity}
              onChange={(e) => {
                setCostQuantity(e.target.value);
                clearAiBadge("cost");
              }}
              className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <select
              value={costUnit}
              onChange={(e) => {
                setCostUnit(e.target.value as (typeof CURRENCY_UNITS)[number]);
                clearAiBadge("cost");
              }}
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            >
              {CURRENCY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {CURRENCY_LABELS_FR[u]}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? t("creationEnCours") : t("creerArme")}
      </button>
    </form>
  );
}
