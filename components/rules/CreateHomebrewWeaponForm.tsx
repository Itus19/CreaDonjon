"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";

interface SelectableRuleset {
  id: string;
  name: string;
  is_official_base: boolean;
}

const DICE_FACES = [4, 6, 8, 10, 12] as const;
const CURRENCY_UNITS = ["gp", "sp", "cp", "ep", "pp"] as const;

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
 */
export default function CreateHomebrewWeaponForm({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("regles");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentRuleset, setCurrentRuleset] = useState<SelectableRuleset | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<"simple" | "martial">("simple");
  const [isRanged, setIsRanged] = useState(false);
  const [diceCount, setDiceCount] = useState(1);
  const [diceFaces, setDiceFaces] = useState<number>(6);
  const [damageType, setDamageType] = useState("");
  const [weight, setWeight] = useState("");
  const [costQuantity, setCostQuantity] = useState("");
  const [costUnit, setCostUnit] = useState<(typeof CURRENCY_UNITS)[number]>("gp");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentRuleset || !name.trim()) return;

    setSubmitting(true);
    setError(null);

    const weapon = {
      category,
      is_ranged: isRanged,
      damage: { dice: { op: "dice", count: diceCount, faces: diceFaces }, type: damageType.trim() || undefined },
      properties: [],
      weight: weight.trim() ? { value: Number(weight), unit: "lb" } : undefined,
      cost: costQuantity.trim() ? { value: Number(costQuantity), unit: costUnit } : undefined,
    };

    const res = await fetch(`/api/worlds/${worldSlug}/rules/weapons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rulesetId: currentRuleset.id, name: name.trim(), weapon }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurCreationArme"));
      return;
    }

    const created = (await res.json()) as { entryKey: string };
    router.push(`/m/${worldSlug}/regles/${created.entryKey}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("chargementRulesets")}</p>;

  if (!currentRuleset || currentRuleset.is_official_base) {
    return <p className="text-sm text-ink-muted">{t("armeMaisonNeedsVariante")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
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

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
          {t("categorieDArme")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "simple" | "martial")}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="simple">{t("armeSimple")}</option>
            <option value="martial">{t("armeDeGuerre")}</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" checked={isRanged} onChange={(e) => setIsRanged(e.target.checked)} />
          {t("armeADistance")}
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("degatsNombreDes")}
          <input
            type="number"
            min={1}
            value={diceCount}
            onChange={(e) => setDiceCount(Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("degatsFaces")}
          <select
            value={diceFaces}
            onChange={(e) => setDiceFaces(Number(e.target.value))}
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
          {t("typeDeDegats")}
          <input
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            placeholder={t("typeDeDegatsExemple")}
            className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("poidsLivres")}
          <input
            type="number"
            min={0}
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-24 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("cout")}
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              value={costQuantity}
              onChange={(e) => setCostQuantity(e.target.value)}
              className="w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <select
              value={costUnit}
              onChange={(e) => setCostUnit(e.target.value as (typeof CURRENCY_UNITS)[number])}
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
