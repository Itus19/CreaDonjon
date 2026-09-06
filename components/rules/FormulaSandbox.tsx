"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EvalMode, TraceStep } from "@/src/core/formula";
import Dropdown from "@/components/shared/Dropdown";

interface ContextRow {
  id: number;
  key: string;
  value: string;
}

let nextRowId = 1;

function defaultRows(): ContextRow[] {
  return [{ id: nextRowId++, key: "FOR", value: "3" }];
}

/**
 * Bac a sable de formule (V1-D4) : meme moteur que le jeu reel, jamais un
 * chemin parallele (ticket, critere 2) — l'appel passe par
 * `/api/formula/evaluate`, qui n'invoque rien d'autre que
 * `parseFormula`/`evaluate`/`formatTrace` (src/core/formula), les memes
 * fonctions que `resolveDamageRoll`/`resolveAttackRoll`
 * (src/core/rules/action.ts) deja cablees aux actions de jeu. Aucune
 * connaissance du vocabulaire de reference ici (pas de "FOR"/"STR_MOD"
 * code en dur cote validation) : une formule reference ce qu'elle veut,
 * l'utilisateur fournit les valeurs de contexte correspondantes a la main —
 * ligne "FOR" pre-remplie seulement pour illustrer le format attendu.
 */
export default function FormulaSandbox() {
  const t = useTranslations("regles");

  const [formula, setFormula] = useState("1d8 + {FOR}");
  const [rows, setRows] = useState<ContextRow[]>(defaultRows);
  const [mode, setMode] = useState<EvalMode>("roll");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ value: number; trace: TraceStep[]; text: string } | null>(null);

  function updateRow(id: number, patch: Partial<ContextRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId++, key: "", value: "0" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const context: Record<string, number> = {};
    for (const row of rows) {
      if (!row.key.trim()) continue;
      context[row.key.trim()] = Number(row.value) || 0;
    }

    const res = await fetch("/api/formula/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, context, mode }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurEvaluationFormule"));
      return;
    }

    setResult((await res.json()) as { value: number; trace: TraceStep[]; text: string });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <h1 className="text-base font-semibold text-ink">{t("bacASable")}</h1>
      <p className="text-xs text-ink-muted">{t("bacASableDescription")}</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("formule")}
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          required
          className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{t("valeursDeContexte")}</span>
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              value={row.key}
              onChange={(e) => updateRow(row.id, { key: e.target.value })}
              placeholder={t("nomDeReference")}
              className="w-28 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <input
              type="number"
              value={row.value}
              onChange={(e) => updateRow(row.id, { value: e.target.value })}
              className="w-20 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={t("retirerValeur")}
              className="text-sm text-danger hover:underline"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="self-start text-xs text-accent hover:underline">
          {t("ajouterValeur")}
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {t("modeEvaluation")}
        <Dropdown
          value={mode}
          onChange={(v) => setMode(v as EvalMode)}
          size="md"
          aria-label={t("mode")}
          options={[
            { value: "roll", label: t("modeJet") },
            { value: "average", label: t("modeMoyenne") },
            { value: "min", label: t("modeMinimum") },
            { value: "max", label: t("modeMaximum") },
          ]}
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy || !formula.trim()}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? t("evaluationEnCours") : t("evaluer")}
      </button>

      {result && (
        <div className="rounded-md border border-edge/60 bg-panel-sunken p-3 text-sm">
          <p className="text-ink">
            <span className="font-semibold">{t("resultat")} : {result.value}</span>
          </p>
          {result.trace.length > 0 && <p className="text-ink-muted">{result.text}</p>}
        </div>
      )}
    </form>
  );
}
