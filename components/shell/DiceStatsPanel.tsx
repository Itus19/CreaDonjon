"use client";

import { useEffect, useState } from "react";
import { extractDiceGroups, parseRollDetail } from "@/src/core/dice/parseRollDetail";
import { computeDiceStats, type DiceStats } from "@/src/core/dice/rollStats";
import type { EconomyStats } from "@/src/core/rules/economyStats";
import type { DiceRollRow } from "@/src/server/repos/diceRolls";

const HISTORY_LIMIT = 200;

/** Deux barres partageant la meme echelle (le plus grand des deux totaux) — comparaison visuelle directe, jamais deux graphiques separes qui obligeraient a comparer des echelles differentes (retour utilisateur : "rends [les stats] plus jolies avec des graphiques"). */
function CompareBars({
  leftLabel,
  leftValue,
  leftColor,
  rightLabel,
  rightValue,
  rightColor,
  formatValue,
}: {
  leftLabel: string;
  leftValue: number;
  leftColor: string;
  rightLabel: string;
  rightValue: number;
  rightColor: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(leftValue, rightValue, 1);
  const fmt = formatValue ?? ((n: number) => String(n));
  return (
    <div className="flex flex-col gap-1.5">
      {[
        { label: leftLabel, value: leftValue, color: leftColor },
        { label: rightLabel, value: rightValue, color: rightColor },
      ].map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-ink-muted">{row.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-sunken">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color }} />
          </div>
          <span className="w-10 shrink-0 text-right font-semibold text-ink">{fmt(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatGold(cp: number): string {
  return `${(cp / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} po`;
}

/**
 * Stats de jets de des ET d'economie de campagne (retour utilisateur, ecran
 * d'accueil joueur : "a la place d'avoir le journal... un petit ecran sur
 * les stats de lance de des", puis "rends le plus joli avec des graphiques
 * au lieu de juste des lignes de textes. Ajoute des stats comme argent
 * dépensé, argent gagné") — remplace le Journal recent sur une carte de
 * monde ou le viewer est Joueur. Jamais un second calcul divergent :
 * `computeDiceStats`/`computeEconomyStats` (src/core) font tout le travail,
 * ce composant ne fait que dessiner des barres proportionnelles a leur
 * resultat.
 */
export default function DiceStatsPanel({ campaignId }: { campaignId: string | null }) {
  const [stats, setStats] = useState<DiceStats | null>(null);
  const [economy, setEconomy] = useState<EconomyStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/dice-rolls?limit=${HISTORY_LIMIT}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { rolls: DiceRollRow[] }) => {
        const input = body.rolls.map((row) => {
          const detail = parseRollDetail(row.detail);
          return { result: row.result, diceGroups: extractDiceGroups(detail.trace), verdict: detail.verdict ?? null };
        });
        setStats(computeDiceStats(input));
      })
      .catch(() => setLoadError("Impossible de charger les stats de jets."));

    fetch(`/api/campaigns/${campaignId}/economy-stats`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: EconomyStats) => setEconomy(body))
      .catch(() => {});
  }, [campaignId]);

  if (!campaignId) {
    return <p className="mt-1 text-xs text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>;
  }
  if (loadError) {
    return <p className="mt-1 text-xs text-danger">{loadError}</p>;
  }
  if (!stats) {
    return <p className="mt-1 text-xs text-ink-muted">…</p>;
  }

  const hasEconomy = economy && (economy.earnedCp > 0 || economy.spentCp > 0);

  return (
    <div className="mt-1 flex flex-col gap-3">
      {stats.totalChecks === 0 ? (
        <p className="text-xs text-ink-muted">Aucun jet pour l&apos;instant.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mech text-2xl font-bold text-ink">{stats.averageTotal!.toFixed(1)}</span>
            <span className="text-xs text-ink-muted">valeur moyenne des jets</span>
          </div>
          <CompareBars
            leftLabel="Réussites"
            leftValue={stats.successCount}
            leftColor="var(--success)"
            rightLabel="Échecs"
            rightValue={stats.failCount}
            rightColor="var(--danger)"
          />
          <CompareBars
            leftLabel="20 nat."
            leftValue={stats.natural20Count}
            leftColor="var(--accent)"
            rightLabel="1 nat."
            rightValue={stats.natural1Count}
            rightColor="var(--ink-muted)"
          />
          <p className="text-[10px] text-ink-muted">Sur les {stats.totalChecks} derniers jets de vérification de la campagne.</p>
        </>
      )}

      {hasEconomy && (
        <div className="flex flex-col gap-1.5 border-t border-edge/30 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Économie</span>
          <CompareBars
            leftLabel="Gagné"
            leftValue={economy.earnedCp}
            leftColor="var(--success)"
            rightLabel="Dépensé"
            rightValue={economy.spentCp}
            rightColor="var(--danger)"
            formatValue={formatGold}
          />
        </div>
      )}
    </div>
  );
}
