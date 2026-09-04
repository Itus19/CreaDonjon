"use client";

import { useState } from "react";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import type { TableEntry, TableEntryPrice } from "@/src/core/tables/types";
import { CURRENCY_ORDER, type CoinType } from "@/src/core/rules/currency";
import { CURRENCY_LABELS_FR, formatTableEntryPrice } from "@/src/i18n/fr";

interface ResolvedDraw {
  text: string;
  price?: TableEntryPrice;
}

/**
 * Editeur du bloc `random_table` (V1-E1, specs/outils-mj.md §2) — meme
 * precedent que les autres editeurs de bloc de wiki (`InfoboxBlockEditor.tsx`
 * etc.) : toujours editable en place, pas de bascule edition/lecture
 * separee. Porte aussi le tirage lui-meme (bouton "Tirer") : le meme
 * composant sert d'auteur et de table a la table pendant la partie.
 *
 * Les references d'entree (`refs`, specs/outils-mj.md §2.1 — "le resultat
 * du tirage est cliquable") n'ont pas encore d'editeur dedie ici : porte
 * par le schema et le moteur de tirage (deja tests), mais pas encore par
 * cette interface — un cas concret pour un prochain ticket, meme discipline
 * que les autres reductions de portee de ce ticket.
 */
export default function RandomTableBlockEditor({
  data,
  onChange,
  blockId,
}: {
  data: RandomTableBlockData;
  onChange: (data: RandomTableBlockData) => void;
  blockId: string;
}) {
  const [drawCount, setDrawCount] = useState(1);
  const [draws, setDraws] = useState<ResolvedDraw[] | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  function updateEntry(index: number, patch: Partial<TableEntry>) {
    onChange({ ...data, entries: data.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
  }

  /** Montant vide -> pas de prix du tout (`price` retire), plutot qu'un prix a 0 pc par defaut — la plupart des tables n'ont aucune notion de prix. */
  function updateEntryAmount(index: number, entry: TableEntry, raw: string) {
    if (raw.trim() === "") {
      updateEntry(index, { price: undefined });
      return;
    }
    const amount = Number(raw);
    if (Number.isNaN(amount)) return;
    updateEntry(index, { price: { amount, coin: entry.price?.coin ?? "cp" } });
  }

  function updateEntryCoin(index: number, entry: TableEntry, coin: CoinType) {
    updateEntry(index, { price: { amount: entry.price?.amount ?? 0, coin } });
  }

  /** Cle libre (V2-J9quater) — cette entree est editee sans connaitre l'axe qui s'y applique (ex. "wealth"), donc pas de liste deroulante ici : l'auteur tape la cle d'option exacte ("modeste", "rare"...). Vide -> `tier` retire, l'entree redevient eligible a tout palier. */
  function updateEntryTier(index: number, raw: string) {
    updateEntry(index, { tier: raw.trim() === "" ? undefined : raw.trim() });
  }

  function removeEntry(index: number) {
    onChange({ ...data, entries: data.entries.filter((_, i) => i !== index) });
  }

  function addEntry() {
    const lastMax = data.entries.at(-1)?.range.max ?? 0;
    onChange({
      ...data,
      entries: [...data.entries, { range: { min: lastMax + 1, max: lastMax + 1 }, weight: 1, text: "" }],
    });
  }

  async function draw() {
    setDrawing(true);
    setDrawError(null);
    const res = await fetch(`/api/blocks/${blockId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: drawCount }),
    });
    setDrawing(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setDrawError(body?.error ?? "Impossible de tirer sur cette table — réessayez.");
      setDraws(null);
      return;
    }
    const body = (await res.json()) as { draws: ResolvedDraw[] };
    setDraws(body.draws);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          Clé
          <input
            value={data.key}
            onChange={(e) => onChange({ ...data, key: e.target.value })}
            placeholder="rumeurs"
            className="w-28 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          Dé
          <input
            value={data.die}
            onChange={(e) => onChange({ ...data, die: e.target.value })}
            placeholder="d20"
            className="w-16 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={data.unique_draws}
            onChange={(e) => onChange({ ...data, unique_draws: e.target.checked })}
          />
          Sans répétition
        </label>
        <input
          value={data.attribution ?? ""}
          onChange={(e) => onChange({ ...data, attribution: e.target.value || undefined })}
          placeholder="Attribution (facultatif)"
          className="flex-1 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        {data.entries.map((entry, index) => (
          <div key={index} className="flex items-start gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
            <div className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
              <input
                type="number"
                value={entry.range.min}
                onChange={(e) => updateEntry(index, { range: { ...entry.range, min: Number(e.target.value) } })}
                className="w-10 bg-transparent text-center outline-none"
              />
              –
              <input
                type="number"
                value={entry.range.max}
                onChange={(e) => updateEntry(index, { range: { ...entry.range, max: Number(e.target.value) } })}
                className="w-10 bg-transparent text-center outline-none"
              />
            </div>
            <input
              value={entry.text}
              onChange={(e) => updateEntry(index, { text: e.target.value })}
              placeholder="Résultat…"
              className="flex-1 bg-transparent text-sm text-ink outline-none"
            />
            <div className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
              <input
                type="number"
                min={0}
                value={entry.price?.amount ?? ""}
                onChange={(e) => updateEntryAmount(index, entry, e.target.value)}
                placeholder="Prix"
                title="Prix (facultatif)"
                className="w-14 rounded-md border border-edge bg-transparent px-1 py-0.5 text-center outline-none"
              />
              <select
                value={entry.price?.coin ?? "cp"}
                onChange={(e) => updateEntryCoin(index, entry, e.target.value as CoinType)}
                disabled={entry.price === undefined}
                title="Pièce"
                className="rounded-md border border-edge bg-transparent px-1 py-0.5 outline-none disabled:opacity-40"
              >
                {CURRENCY_ORDER.map((coin) => (
                  <option key={coin} value={coin}>
                    {CURRENCY_LABELS_FR[coin]}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={entry.tier ?? ""}
              onChange={(e) => updateEntryTier(index, e.target.value)}
              placeholder="Palier"
              title="Palier sur un axe de variante (facultatif, ex. « modeste »)"
              className="w-20 shrink-0 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
            />
            <button type="button" onClick={() => removeEntry(index)} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="mt-2 self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un résultat
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-edge/60 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={draw}
            disabled={drawing}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {drawing ? "Tirage…" : "Tirer"}
          </button>
          <input
            type="number"
            min={1}
            max={20}
            value={drawCount}
            onChange={(e) => setDrawCount(Math.max(1, Number(e.target.value)))}
            className="w-14 rounded-md border border-edge bg-transparent px-1.5 py-1 text-xs text-ink outline-none"
          />
        </div>
        {drawError && <p className="text-xs text-danger">{drawError}</p>}
        {draws && (
          <ul className="flex flex-col gap-1 rounded-md border border-edge/60 bg-panel-sunken p-2 text-sm">
            {draws.map((d, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-ink">
                <span>{d.text}</span>
                {formatTableEntryPrice(d.price) && <span className="text-ink-muted">{formatTableEntryPrice(d.price)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
