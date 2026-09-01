"use client";

import { useEffect, useState } from "react";
import { extractDiceGroups, parseRollDetail } from "@/src/core/dice/parseRollDetail";
import { computeDiceStats, type DiceStats } from "@/src/core/dice/rollStats";
import type { DiceRollRow } from "@/src/server/repos/diceRolls";

const HISTORY_LIMIT = 200;

/** Une ligne "Label .... Valeur", meme motif que le reste de la colonne (retour utilisateur, ecran d'accueil). */
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-edge/30 pb-1 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

/**
 * Stats de jets de des (retour utilisateur, ecran d'accueil joueur : "a la
 * place d'avoir le journal... un petit ecran sur les stats de lance de des")
 * — remplace le Journal recent sur une carte de monde ou le viewer est
 * Joueur. Memes jets que le volet de lancer (`dice_rolls`, RLS deja filtree
 * — un jet `gm` reste invisible ici comme partout ailleurs), meme
 * extraction de trace (`src/core/dice/parseRollDetail.ts`), jamais un
 * second calcul divergent.
 */
export default function DiceStatsPanel({ campaignId }: { campaignId: string | null }) {
  const [stats, setStats] = useState<DiceStats | null>(null);
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
  if (stats.totalChecks === 0) {
    return <p className="mt-1 text-xs text-ink-muted">Aucun jet pour l&apos;instant.</p>;
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <StatRow label="Valeur moyenne" value={stats.averageTotal!.toFixed(1)} />
      <StatRow label="20 naturels" value={stats.natural20Count} />
      <StatRow label="1 naturels" value={stats.natural1Count} />
      <StatRow label="Réussites" value={stats.successCount} />
      <StatRow label="Échecs" value={stats.failCount} />
      <p className="mt-0.5 text-[10px] text-ink-muted">
        Sur les {stats.totalChecks} derniers jets de vérification de la campagne.
      </p>
    </div>
  );
}
