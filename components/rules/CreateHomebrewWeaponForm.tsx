"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";
import type { WeaponProposal } from "@/src/core/ai/weaponProposal";
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import DescriptionTextarea from "@/components/rules/DescriptionTextarea";

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

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"simple" | "martial">("simple");
  const [isRanged, setIsRanged] = useState(false);
  const [diceCount, setDiceCount] = useState(1);
  const [diceFaces, setDiceFaces] = useState<number>(6);
  const [damageType, setDamageType] = useState("");
  const [versatile, setVersatile] = useState(false);
  const [versatileDiceCount, setVersatileDiceCount] = useState(1);
  const [versatileDiceFaces, setVersatileDiceFaces] = useState<number>(8);
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
      setWeight(String(p.weight_lb));
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
      properties: [],
      weight: weight.trim() ? { value: Number(weight), unit: "lb" } : undefined,
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
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isRanged}
            onChange={(e) => {
              setIsRanged(e.target.checked);
              clearAiBadge("is_ranged");
            }}
          />
          {t("armeADistance")}
          <AiBadge shown={aiFilledFields.has("is_ranged")} label={t("champRempliParIA")} />
        </label>
      </div>

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
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={versatile}
            onChange={(e) => {
              setVersatile(e.target.checked);
              clearAiBadge("versatile");
            }}
          />
          {t("armePolyvalente")}
          <AiBadge shown={aiFilledFields.has("versatile")} label={t("champRempliParIA")} />
        </label>
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

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          <span className="flex items-center gap-1.5">
            {t("poidsLivres")}
            <AiBadge shown={aiFilledFields.has("weight")} label={t("champRempliParIA")} />
          </span>
          <input
            type="number"
            min={0}
            step="0.5"
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
