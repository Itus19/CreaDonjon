"use client";

import { useEffect, useState } from "react";
import type { EncounterBlockData, EncounterParticipant } from "@/src/core/schemas/blocks/encounter";
import { encounterBudget, encounterCost, type EncounterBudgetRow } from "@/src/core/rules/encounter";

/**
 * Editeur du bloc `encounter` (V1-E3, specs/outils-mj.md §4.2-4.3) : compose
 * une rencontre (niveaux du groupe + participants) et affiche une barre de
 * budget qui se remplit et se colore en direct — « le MJ voit la difficulte
 * bouger pendant qu'il compose », citation de la spec. La table de budget
 * (par ruleset) est chargee une seule fois au montage ; tout le calcul
 * ensuite est purement client (`encounterBudget`/`encounterCost`, meme
 * fonctions que le noyau teste), aucun aller-retour serveur par frappe.
 */
export default function EncounterBlockEditor({
  data,
  onChange,
  worldSlug,
}: {
  data: EncounterBlockData;
  onChange: (data: EncounterBlockData) => void;
  worldSlug: string;
}) {
  const [budgetTable, setBudgetTable] = useState<EncounterBudgetRow[] | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/worlds/${worldSlug}/rules/encounter-budget`)
      .then((res) => (res.ok ? res.json() : { rows: null }))
      .then((body: { rows: EncounterBudgetRow[] | null }) => setBudgetTable(body.rows))
      .catch(() => setBudgetTable(null));
  }, [worldSlug]);

  function updateLevel(index: number, level: number) {
    onChange({ ...data, partyLevels: data.partyLevels.map((l, i) => (i === index ? level : l)) });
  }
  function removeLevel(index: number) {
    onChange({ ...data, partyLevels: data.partyLevels.filter((_, i) => i !== index) });
  }
  function addLevel() {
    onChange({ ...data, partyLevels: [...data.partyLevels, 1] });
  }

  function updateParticipant(index: number, patch: Partial<EncounterParticipant>) {
    onChange({ ...data, participants: data.participants.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }
  function removeParticipant(index: number) {
    onChange({ ...data, participants: data.participants.filter((_, i) => i !== index) });
  }
  function addParticipant() {
    onChange({
      ...data,
      participants: [...data.participants, { id: crypto.randomUUID(), label: "", xp: 0, count: 1 }],
    });
  }

  const cost = encounterCost(data.participants);

  let budget: { low: number; moderate: number; high: number } | null = null;
  let budgetError: string | null = null;
  if (budgetTable && data.partyLevels.length > 0) {
    try {
      budget = {
        low: encounterBudget(data.partyLevels, "low", budgetTable),
        moderate: encounterBudget(data.partyLevels, "moderate", budgetTable),
        high: encounterBudget(data.partyLevels, "high", budgetTable),
      };
    } catch {
      budgetError = "Un des niveaux du groupe dépasse la table de budget (1 à 20).";
    }
  }

  const band = !budget
    ? null
    : cost < budget.low
      ? "sous le seuil"
      : cost < budget.moderate
        ? "faible"
        : cost < budget.high
          ? "modérée"
          : "élevée";
  // Memes jetons de couleur que le reste de l'interface (specs/coquille-et-design.md
  // §2) — jamais une couleur Tailwind par defaut hors du systeme de jetons :
  // --gm (terracotta, deja utilise pour les badges "MJ uniquement") sert ici
  // de palier intermediaire, faute d'un jeton "avertissement" dedie.
  const barColor =
    band === "sous le seuil" ? "bg-ink-muted" : band === "faible" ? "bg-accent" : band === "modérée" ? "bg-gm" : "bg-danger";
  const barWidth = budget ? Math.min(100, (cost / budget.high) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Niveaux du groupe</span>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {data.partyLevels.map((level, index) => (
            <div key={index} className="flex items-center gap-0.5 rounded-full border border-edge bg-panel-sunken px-2 py-0.5">
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => updateLevel(index, Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-8 bg-transparent text-center text-xs text-ink outline-none"
              />
              <button type="button" onClick={() => removeLevel(index)} className="text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLevel}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            + Personnage
          </button>
        </div>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Participants</span>
        <div className="mt-1 flex flex-col gap-0.5">
          {data.participants.map((p, index) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
              <input
                value={p.label}
                onChange={(e) => updateParticipant(index, { label: e.target.value })}
                placeholder="Nom (ex. Gobelours)"
                className="flex-1 bg-transparent text-sm text-ink outline-none"
              />
              <input
                type="number"
                min={0}
                value={p.xp}
                onChange={(e) => updateParticipant(index, { xp: Math.max(0, Number(e.target.value)) })}
                className="w-16 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
                title="Points d'expérience"
              />
              <span className="text-[10px] text-ink-muted">PX ×</span>
              <input
                type="number"
                min={1}
                value={p.count}
                onChange={(e) => updateParticipant(index, { count: Math.max(1, Number(e.target.value)) })}
                className="w-12 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
              <button type="button" onClick={() => removeParticipant(index)} className="text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addParticipant}
            className="mt-2 self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            + Ajouter une créature
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-edge/60 pt-3">
        {budgetTable === undefined && <p className="text-xs text-ink-muted">Chargement du budget…</p>}
        {budgetTable === null && (
          <p className="text-xs text-ink-muted">
            Budget de rencontre non disponible pour le ruleset de ce monde (aucune table de budget de PX connue).
          </p>
        )}
        {budgetError && <p className="text-xs text-danger">{budgetError}</p>}
        {budget && (
          <>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel-sunken">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
            </div>
            <p className="text-xs text-ink-muted">
              <span className="mech text-ink">{cost}</span> PX dépensés — difficulté <span className="text-ink">{band}</span>
              {" · "}Faible {budget.low} · Modérée {budget.moderate} · Élevée {budget.high}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
