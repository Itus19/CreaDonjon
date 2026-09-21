"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import { TRIGGER_EVENTS, type ResolvedEffect, type TriggerEvent } from "@/src/core/rules/triggers";

interface SimulationResult {
  effects: ResolvedEffect[];
  trace: string[];
  failures: { triggerId: string; reason: string }[];
  error?: { code: string; message: string };
}

/** Exemple pre-rempli : la regle qui a servi de cas dore a tout le lot A. */
const EXEMPLE = JSON.stringify(
  {
    id: "concentration",
    when: { event: "damage_taken" },
    if: {
      op: "and",
      args: [
        { op: "has_condition", who: "moi", key: "concentrating" },
        { op: "gte", args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 1 }] },
      ],
    },
    then: [
      {
        action: "saving_throw",
        who: "moi",
        ability: "con",
        dc: {
          op: "max",
          args: [
            { op: "num", value: 10 },
            { op: "floor", args: [{ op: "div", args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 2 }] }] },
          ],
        },
        on_fail: [{ action: "remove_condition", who: "moi", key: "concentrating" }],
      },
    ],
  },
  null,
  2,
);

/**
 * Bac a sable de declencheurs (V3-A5) — « si tel evenement survient avec
 * telles donnees, voici ce qui se passerait ».
 *
 * Meme forme et meme promesse que `FormulaSandbox.tsx` (V1-D4) : l'appel
 * passe par `/api/triggers/simulate`, qui invoque `runTriggers`, EXACTEMENT
 * la fonction que le jeu appelle sur un vrai jet. Un bac a sable qui
 * simulerait a sa facon mentirait le jour ou l'on en aurait besoin.
 *
 * Le declencheur se saisit ici en JSON, volontairement : le formulaire
 * guide vit sur la fiche d'aptitude (`CreateHomebrewFeatureForm`), la ou on
 * ECRIT une regle. Ici on ESSAIE, y compris une regle copiee d'ailleurs ou
 * pas encore enregistree — un formulaire imposerait de la saisir deux fois.
 */
export default function TriggerSandbox() {
  const t = useTranslations("regles");

  const [source, setSource] = useState(EXEMPLE);
  const [event, setEvent] = useState<TriggerEvent>("damage_taken");
  const [subject, setSubject] = useState("moi");
  const [tags, setTags] = useState("");
  const [damage, setDamage] = useState("22");
  const [conditions, setConditions] = useState("concentrating");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  function splitList(raw: string): string[] {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    let trigger: unknown;
    try {
      trigger = JSON.parse(source);
    } catch {
      // Un JSON casse est une saisie, pas une panne : on le dit sans appeler.
      setBusy(false);
      setError(t("declencheurIllisible"));
      return;
    }

    const res = await fetch("/api/triggers/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggers: [trigger],
        event: {
          event,
          subject,
          data: damage.trim() === "" ? undefined : { "event.damage": Number(damage) || 0 },
          tags: splitList(tags),
        },
        actors: {
          [subject]: {
            conditions: splitList(conditions),
            features: [],
            // De quoi qu'un jet de sauvegarde declenche ait un bonus a ajouter.
            numbers: { "save.con": 3, "save.dex": 3, "save.wis": 1 },
          },
        },
      }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurSimulation"));
      return;
    }
    setResult((await res.json()) as SimulationResult);
  }

  function describe(effect: ResolvedEffect): string {
    switch (effect.action) {
      case "saving_throw":
        return `${effect.who} — sauvegarde de ${effect.ability} : ${effect.total} contre DD ${effect.dc} → ${effect.passed ? "réussie" : "ratée"}`;
      case "remove_condition":
        return `${effect.who} perd « ${effect.key} »`;
      case "apply_condition":
        return `${effect.who} reçoit « ${effect.key} »`;
      case "deal_damage":
        return `${effect.who} subit ${effect.amount} dégâts`;
      case "heal":
        return `${effect.who} récupère ${effect.amount} points de vie`;
      case "grant_budget":
        return `${effect.who} — budget « ${effect.kind} » ${effect.amount >= 0 ? "+" : ""}${effect.amount}`;
      case "apply_modifier":
        return `${effect.who} — ${effect.modifier.label} (${effect.modifier.target})`;
      case "move":
        return `${effect.who} passe en zone « ${effect.zone} »`;
      case "spend_resource":
        return `${effect.who} dépense ${effect.amount} de « ${effect.key} »`;
      case "roll":
        return `${effect.label} : ${effect.value}`;
      case "narrate_hint":
        return `Souffler au narrateur : « ${effect.text} »`;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("bacASableDeclencheurs")}</h1>
      <p className="text-xs text-ink-muted">{t("bacASableDeclencheursDescription")}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("declencheurASimuler")}
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={14}
          spellCheck={false}
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 font-mono text-xs text-ink outline-none"
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("evenementSurvenu")}
          <Dropdown
            value={event}
            onChange={(v) => setEvent(v as TriggerEvent)}
            size="md"
            aria-label={t("evenementSurvenu")}
            options={TRIGGER_EVENTS.map((e) => ({ value: e, label: e }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("sujetDeLEvenement")}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-32 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("donneesEvenement")} — event.damage
          <input
            type="number"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            className="w-24 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("etiquettesEvenement")}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="skill:deception, ability:cha"
            className="w-64 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink">
          {t("conditionsDuSujet")}
          <input
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="concentrating, prone"
            className="w-64 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? t("simulationEnCours") : t("simuler")}
      </button>

      {result && (
        <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3 text-sm">
          <p className="font-semibold text-ink">{t("effetsProduits")}</p>
          {result.effects.length === 0 ? (
            <p className="text-ink-muted">{t("rienNeSeDeclenche")}</p>
          ) : (
            <ul className="list-inside list-disc text-ink-muted">
              {result.effects.map((e, i) => (
                <li key={i}>{describe(e)}</li>
              ))}
            </ul>
          )}

          {/* Un echec est l'information la plus utile d'un bac a sable : il
              se montre au meme rang que le succes, jamais en petit. */}
          {result.failures.length > 0 && (
            <>
              <p className="font-semibold text-danger">{t("declencheursEnEchec")}</p>
              <ul className="list-inside list-disc text-danger">
                {result.failures.map((f, i) => (
                  <li key={i}>
                    {f.triggerId} — {f.reason}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.error && <p className="text-danger">{result.error.message}</p>}

          {result.trace.length > 0 && (
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-ink-muted">{result.trace.join("\n")}</pre>
          )}
        </div>
      )}
    </form>
  );
}
